import sql from 'mssql';
import { BaseDatabaseAdapter } from '../base-adapter';
import type {
  AdapterConnectionConfig,
  DatabaseType,
  ExecuteOptions,
  ParameterizedQuery,
} from '../types';
import { SQLServerQueries } from '../queries/sqlserver.queries';
import { QUERY_TIMEOUT } from '@/lib/constants';

export class SQLServerAdapter extends BaseDatabaseAdapter {
  readonly type: DatabaseType = 'sqlserver';
  readonly displayName = 'Microsoft SQL Server';
  readonly defaultPort = 1433;
  // mssql Request objects expose cancel(), which sends a tedious ATTENTION
  // packet on the same socket — no second connection required.
  readonly supportsCancellation = true;

  private pool: sql.ConnectionPool | null = null;

  async connect(config: AdapterConnectionConfig): Promise<void> {
    // Own the pool per adapter instance. Do NOT use the module-level
    // `sql.connect()`: mssql's global-connection helper creates the pool from the
    // FIRST caller's config and returns that same pool to every later caller
    // regardless of its config, so two concurrent requests to different
    // connections could run one user's SQL against the other's database. It also
    // rebinds close() to null the module global, letting one request's
    // disconnect() tear down a pool another request is still using.
    this.pool = new sql.ConnectionPool({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      // mssql defaults requestTimeout to 15s, which would kill legitimate long
      // queries before a user could react. Set it explicitly to the app-wide
      // ceiling so it doubles as the backstop for a failed cancellation.
      requestTimeout: QUERY_TIMEOUT.STATEMENT_MS,
      options: {
        encrypt: config.ssl !== false,
        trustServerCertificate: true,
      },
    });
    await this.pool.connect();

    this.config = config;
    this.readOnly = !!config.readOnly;
    this.dirtyRead = !!config.dirtyRead;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
    this.connected = false;
    this.config = null;
  }

  async executeRawQuery(
    sqlQuery: string,
    options?: ExecuteOptions
  ): Promise<Record<string, unknown>[]> {
    if (!this.pool) {
      throw new Error('Not connected to SQL Server');
    }
    if (this.readOnly) {
      // T-SQL has no true read-only transaction mode, so wrap the query in a
      // transaction and ALWAYS roll back — this discards any DML the AST validator
      // missed. NOTE: some DDL (CREATE/DROP/TRUNCATE) auto-commits and cannot be
      // rolled back in SQL Server; the AST validator is the primary defense there.
      //
      // When dirtyRead is set the transaction begins at READ UNCOMMITTED — the
      // transaction-scoped equivalent of putting WITH (NOLOCK) on every table,
      // including ones reached through views and subqueries, without touching the
      // user's SQL (which the AST validator would reject). The level rides the
      // TRANSACTION, not the session, so it cannot leak to other requests through
      // the pool. Do not "simplify" this into a session-level SET TRANSACTION
      // ISOLATION LEVEL, which would contaminate pooled connections.
      const tx = new sql.Transaction(this.pool);
      // Pass undefined, never 0: 0x00 is tedious's NO_CHANGE and is absent from
      // mssql's own isolation map, which throws 'Invalid isolation level.'
      await tx.begin(this.dirtyRead ? sql.ISOLATION_LEVEL.READ_UNCOMMITTED : undefined);
      try {
        return await this.runCancellable(new sql.Request(tx), sqlQuery, options?.signal);
      } finally {
        // Swallow rollback failures: a rollback after a cancelled statement often
        // throws ("No transaction is begun"), and an unguarded throw here would
        // REPLACE the original error — masking the cancellation the route needs
        // to detect, or the real SQL error the user needs to see.
        await tx.rollback().catch(() => {});
      }
    }
    return this.runCancellable(this.pool.request(), sqlQuery, options?.signal);
  }

  /**
   * Runs a query with the Request retained so an abort can reach it — the inline
   * `new sql.Request(tx).query(...)` form discards the only handle that can
   * cancel. Order-independent by design: mssql's default cancel just sets
   * `canceled`, which the driver checks before starting execution, so an abort
   * that lands before the query is dispatched still works.
   */
  private async runCancellable(
    request: sql.Request,
    sqlQuery: string,
    signal?: AbortSignal
  ): Promise<Record<string, unknown>[]> {
    if (!signal) {
      const result = await request.query(sqlQuery);
      return result.recordset as Record<string, unknown>[];
    }

    // Throws if the cancel landed before we got here, so we never start work
    // that is already unwanted.
    signal.throwIfAborted();

    // The listener must never throw: an exception raised synchronously inside an
    // 'abort' handler is an uncaught exception and would take down the process.
    const onAbort = () => {
      try {
        request.cancel();
      } catch {
        /* best effort — the UI is already unblocked */
      }
    };

    signal.addEventListener('abort', onAbort, { once: true });
    try {
      const result = await request.query(sqlQuery);
      return result.recordset as Record<string, unknown>[];
    } finally {
      // Remove while this Request is provably still ours, so a late abort can
      // never reach a recycled one.
      signal.removeEventListener('abort', onAbort);
    }
  }

  async executeParameterizedQuery(query: ParameterizedQuery): Promise<Record<string, unknown>[]> {
    if (!this.pool) {
      throw new Error('Not connected to SQL Server');
    }

    const request = this.pool.request();

    // Add parameters with named bindings
    // SQL Server uses @paramName style, we assume params array corresponds to @tableName
    query.params.forEach((param, index) => {
      // Extract parameter name from query (e.g., @tableName)
      const paramNames = query.sql.match(/@\w+/g) || [];
      const paramName = paramNames[index]?.substring(1) || `param${index}`;
      request.input(paramName, param);
    });

    const result = await request.query(query.sql);
    return result.recordset as Record<string, unknown>[];
  }

  /** Active namespace for this connection; defaults to SQL Server's "dbo". */
  private schemaName(): string {
    return this.config?.schema || 'dbo';
  }

  async listSchemas(): Promise<string[]> {
    if (!this.pool) {
      throw new Error('Not connected to SQL Server');
    }
    // Exclude SQL Server's built-in/system schemas, leaving dbo + user schemas.
    const result = await this.pool.request().query(`
      SELECT name
      FROM sys.schemas
      WHERE name NOT IN (
        'sys', 'INFORMATION_SCHEMA', 'guest',
        'db_owner', 'db_accessadmin', 'db_securityadmin', 'db_ddladmin',
        'db_backupoperator', 'db_datareader', 'db_datawriter',
        'db_denydatareader', 'db_denydatawriter'
      )
      ORDER BY name
    `);
    return (result.recordset as { name: string }[]).map((r) => r.name);
  }

  getTablesQuery(): ParameterizedQuery {
    return SQLServerQueries.tables(this.schemaName());
  }

  getColumnsQuery(tableName: string): ParameterizedQuery {
    return SQLServerQueries.columnsForTable(tableName, this.schemaName());
  }

  getForeignKeysQuery(tableName: string): ParameterizedQuery {
    return SQLServerQueries.foreignKeysForTable(tableName, this.schemaName());
  }

  // SQL Server uses square brackets for identifiers
  escapeIdentifier(identifier: string): string {
    return `[${identifier.replace(/\]/g, ']]')}]`;
  }
}
