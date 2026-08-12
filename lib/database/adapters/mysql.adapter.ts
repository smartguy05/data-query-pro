import mysql from 'mysql2/promise';
import type { Connection } from 'mysql2/promise';
import { BaseDatabaseAdapter } from '../base-adapter';
import type { AdapterConnectionConfig, DatabaseType, ExecuteOptions, ParameterizedQuery, IntrospectionResult, ProgressCallback } from '../types';
import { MySQLQueries } from '../queries/mysql.queries';
import { QUERY_TIMEOUT } from '@/lib/constants';

// Local Column interface matching the model (models don't export properly)
interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primary_key?: boolean;
  foreign_key?: string;
  description?: string;
  aiDescription?: string;
}

export class MySQLAdapter extends BaseDatabaseAdapter {
  readonly type: DatabaseType = 'mysql';
  readonly displayName = 'MySQL';
  readonly defaultPort = 3306;
  // Cancellable via `KILL QUERY <threadId>` issued on a second connection.
  readonly supportsCancellation = true;

  private client: Connection | null = null;
  private databaseName: string = '';

  async connect(config: AdapterConnectionConfig): Promise<void> {
    this.client = await mysql.createConnection({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    });

    // Server-side ceiling on SELECTs, and the backstop for a cancellation that
    // fails. Fails OPEN: MySQL 5.7.8+ only, and MariaDB names it
    // max_statement_time and will reject this — neither is worth failing a
    // connection over, since the worst case is the previous behavior.
    try {
      await this.client.query(`SET SESSION max_execution_time = ${QUERY_TIMEOUT.STATEMENT_MS}`);
    } catch (err) {
      console.warn('[mysql] statement timeout not applied:', err);
    }

    if (config.dirtyRead) {
      // Issued here, OUTSIDE any transaction, on purpose: MySQL raises
      // ER_CANT_CHANGE_TX_CHARACTERISTICS (1568) if transaction characteristics
      // change while one is open, and executeRawQuery opens one via
      // START TRANSACTION READ ONLY. Doing it at connect time makes that error
      // structurally impossible and costs one round trip per request, not per
      // query.
      //
      // SESSION scope is safe ONLY because this is a per-request
      // createConnection (not a pool) that disconnect() closes — with a pool,
      // READ UNCOMMITTED would leak to unrelated requests, including schema
      // introspection. No reset before disconnect() is needed for the same
      // reason: session variables die with the connection.
      //
      // Fails OPEN, like the timeout above.
      try {
        await this.client.query('SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
      } catch (err) {
        console.warn('[mysql] dirty-read isolation not applied:', err);
      }
    }

    this.databaseName = config.database;
    this.config = config;
    this.readOnly = !!config.readOnly;
    this.dirtyRead = !!config.dirtyRead;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
    this.connected = false;
    this.config = null;
  }

  async executeRawQuery(sql: string, options?: ExecuteOptions): Promise<Record<string, unknown>[]> {
    if (!this.client) {
      throw new Error('Not connected to MySQL');
    }
    if (this.readOnly) {
      // READ ONLY transaction rejects any write; always roll back afterward.
      // mysql2's multipleStatements defaults to false, so ;-stacked statements
      // are already blocked at the driver level.
      //
      // Access mode (READ ONLY) and isolation level are orthogonal transaction
      // characteristics, so this composes with the READ UNCOMMITTED set in
      // connect() — in fact READ ONLY + READ UNCOMMITTED is InnoDB's cheapest
      // read path, creating no read view at all.
      await this.client.query('START TRANSACTION READ ONLY');
      try {
        return await this.runCancellable(sql, options?.signal);
      } finally {
        // Swallow rollback failures: after an interrupted query the ROLLBACK
        // itself often fails, and an unguarded throw here would REPLACE the
        // original error — masking the cancellation the route must detect, or
        // the real SQL error the user needs to see.
        await this.client.query('ROLLBACK').catch(() => {});
      }
    }
    return this.runCancellable(sql, options?.signal);
  }

  /**
   * Runs the query, wiring an abort to a real server-side `KILL QUERY`. Aborting
   * the socket instead (connection.destroy()) would leave the query running to
   * completion on the server, which is the exact problem cancellation exists to
   * solve.
   */
  private async runCancellable(
    sql: string,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>[]> {
    if (!this.client) {
      throw new Error('Not connected to MySQL');
    }
    if (!signal) {
      const [rows] = await this.client.execute(sql);
      return rows as Record<string, unknown>[];
    }

    // Throws if the cancel landed before we got here, so we never start work
    // that is already unwanted.
    signal.throwIfAborted();

    // mysql2 exposes the server-side thread id on the connection, so targeting
    // the kill costs no extra round trip.
    const threadId = this.client.threadId;
    // The listener must never throw and is never awaited: an exception raised
    // synchronously inside an 'abort' handler is an uncaught exception and would
    // take down the process.
    const onAbort = () => {
      void this.killQuery(threadId).catch(() => {});
    };
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      const [rows] = await this.client.execute(sql);
      return rows as Record<string, unknown>[];
    } finally {
      // Removed while this thread id is provably still ours. MySQL recycles
      // thread ids, so a listener surviving past the statement could kill an
      // unrelated session's query.
      signal.removeEventListener('abort', onAbort);
    }
  }

  /**
   * Kills the in-flight query from a second, short-lived connection — a cancel
   * cannot be sent on the connection that is busy running the query. Never
   * throws: the UI is already unblocked by the time this runs.
   */
  private async killQuery(threadId: number): Promise<void> {
    const cfg = this.config;
    if (!cfg || !Number.isInteger(threadId)) return;
    let admin: Connection | null = null;
    try {
      admin = await mysql.createConnection({
        host: cfg.host,
        port: cfg.port,
        database: cfg.database,
        user: cfg.username,
        password: cfg.password,
        ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 5000,
      });
      // KILL accepts no placeholders. threadId is driver-supplied and integer-
      // checked above, so this interpolation cannot carry user input.
      await admin.query(`KILL QUERY ${threadId}`);
    } catch (err) {
      console.warn('[mysql] KILL QUERY failed:', err);
    } finally {
      if (admin) await admin.end().catch(() => {});
    }
  }

  async executeParameterizedQuery(query: ParameterizedQuery): Promise<Record<string, unknown>[]> {
    if (!this.client) {
      throw new Error('Not connected to MySQL');
    }
    // Use mysql2's built-in parameterized query support with .execute()
    const [rows] = await this.client.execute(query.sql, query.params);
    return rows as Record<string, unknown>[];
  }

  getTablesQuery(): string {
    // For the tables query, we need to return a parameterized version
    // but the base adapter expects a string. We'll use executeParameterizedQuery
    // in introspectSchema override instead
    const query = MySQLQueries.tables(this.databaseName);
    // Return empty string as we override introspectSchema
    return '';
  }

  getColumnsQuery(tableName: string): ParameterizedQuery {
    return MySQLQueries.columnsForTable(this.databaseName, tableName);
  }

  getForeignKeysQuery(tableName: string): ParameterizedQuery {
    return MySQLQueries.foreignKeysForTable(this.databaseName, tableName);
  }

  // Override introspectSchema to use parameterized tables query
  async introspectSchema(
    onProgress?: ProgressCallback,
    options?: ExecuteOptions
  ): Promise<IntrospectionResult> {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }
    options?.signal?.throwIfAborted();

    onProgress?.(10, 'Fetching table list...');

    // Use parameterized query for tables
    const tablesQuery = MySQLQueries.tables(this.databaseName);
    const tablesResult = await this.executeParameterizedQuery(tablesQuery);
    const tableNames = tablesResult.map((row) => row.table_name as string);

    const tables: { name: string; columns: Column[]; description?: string; aiDescription?: string }[] = [];

    for (let i = 0; i < tableNames.length; i++) {
      // Cooperative cancellation point: abandons the walk between tables.
      options?.signal?.throwIfAborted();
      const tableName = tableNames[i];
      const progress = 10 + Math.floor((i / tableNames.length) * 80);
      onProgress?.(progress, `Processing table ${i + 1}/${tableNames.length}: ${tableName}`);

      // Get columns using parameterized query
      const columnsQuery = this.getColumnsQuery(tableName);
      const columnsResult = await this.executeParameterizedQuery(columnsQuery);

      // Get foreign keys using parameterized query
      const fkQuery = this.getForeignKeysQuery(tableName);
      const fkResult = await this.executeParameterizedQuery(fkQuery);
      const fkMap = new Map<string, string>();
      fkResult.forEach((fk) => {
        const columnName = fk.column_name as string;
        const foreignTable = fk.foreign_table_name as string;
        const foreignColumn = fk.foreign_column_name as string;
        fkMap.set(columnName, `${foreignTable}.${foreignColumn}`);
      });

      // Build columns array
      const columns: Column[] = columnsResult.map((col) => ({
        name: col.column_name as string,
        type: col.data_type as string,
        nullable: Boolean(col.is_nullable),
        primary_key: Boolean(col.is_primary_key),
        foreign_key: fkMap.get(col.column_name as string),
        description: undefined,
        aiDescription: undefined,
      }));

      tables.push({
        name: tableName,
        columns,
        description: undefined,
        aiDescription: undefined,
      });
    }

    onProgress?.(100, `Completed! Found ${tables.length} tables.`);

    return { tables };
  }

  // MySQL uses backticks for identifiers
  escapeIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }
}
