import postgres from 'postgres';
import { BaseDatabaseAdapter } from '../base-adapter';
import type {
  AdapterConnectionConfig,
  DatabaseType,
  ExecuteOptions,
  ParameterizedQuery,
} from '../types';
import { PostgreSQLQueries } from '../queries/postgresql.queries';
import { QUERY_TIMEOUT } from '@/lib/constants';

export class PostgreSQLAdapter extends BaseDatabaseAdapter {
  readonly type: DatabaseType = 'postgresql';
  readonly displayName = 'PostgreSQL';
  readonly defaultPort = 5432;
  // Cancellable via `pg_cancel_backend(pid)` issued on a second connection.
  readonly supportsCancellation = true;

  private client: ReturnType<typeof postgres> | null = null;

  /** SSL settings for a connection; shared by connect() and the cancel client. */
  private sslConfig(config: AdapterConnectionConfig) {
    return config.host.includes('azure')
      ? { rejectUnauthorized: false }
      : config.ssl === true
        ? { rejectUnauthorized: false }
        : config.ssl || false;
  }

  async connect(config: AdapterConnectionConfig): Promise<void> {
    this.client = postgres({
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      ssl: this.sslConfig(config),
    });

    // Test connection with a simple query
    await this.client`SELECT 1`;
    this.config = config;
    this.readOnly = !!config.readOnly;
    this.dirtyRead = !!config.dirtyRead;
    // Tracked for observability only — PostgreSQL has NO dirty-read mode. It
    // accepts READ UNCOMMITTED solely as a synonym for READ COMMITTED, and under
    // MVCC readers never block writers, so there is nothing to opt out of:
    // executeRawQuery() is intentionally unchanged. supportsDirtyRead('postgresql')
    // is false, so the execute route reports this back to the user as a no-op
    // instead of pretending it worked.
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

  /** Active namespace for this connection; defaults to PostgreSQL's "public". */
  private schemaName(): string {
    return this.config?.schema || 'public';
  }

  /**
   * search_path value applied (transaction-locally) around raw query execution
   * so unqualified table names resolve to the active schema, with "public"
   * retained as a fallback for shared types/extensions.
   */
  private searchPath(): string {
    const schema = this.schemaName();
    return schema === 'public' ? 'public' : `${schema}, public`;
  }

  async executeRawQuery(
    sql: string,
    options?: ExecuteOptions
  ): Promise<Record<string, unknown>[]> {
    if (!this.client) {
      throw new Error('Not connected to PostgreSQL');
    }
    const signal = options?.signal;
    // Throws if the cancel landed before we got here, so we never start work
    // that is already unwanted.
    signal?.throwIfAborted();

    const searchPath = this.searchPath();
    // A READ ONLY transaction rejects any write (including via functions) with
    // "cannot execute ... in a read-only transaction"; committing one is
    // harmless. An empty options string is exactly equivalent to begin(fn), so a
    // single call site keeps the body below single-sourced.
    //
    // Isolation is deliberately left at the server default even when
    // config.dirtyRead is set — see the dirtyRead note in connect().
    const result = await this.client.begin(this.readOnly ? 'read only' : '', async (tx) => {
      // set_config with is_local=true (i.e. SET LOCAL) scopes both settings to
      // this transaction, guaranteeing they apply to the same pooled connection
      // that runs `sql` — a connect-time SET would not, since the pool hands out
      // other connections. statement_timeout is the backstop for a cancellation
      // that fails or never arrives. The same round trip returns the backend PID,
      // so cancellation costs no extra query.
      const [meta] = await tx<{ pid: number }[]>`
        SELECT set_config('search_path', ${searchPath}, true) AS search_path,
               set_config('statement_timeout', ${String(QUERY_TIMEOUT.STATEMENT_MS)}, true) AS statement_timeout,
               pg_backend_pid() AS pid
      `;

      const pid = Number(meta?.pid);
      if (!signal || !Number.isInteger(pid)) {
        return tx.unsafe(sql);
      }

      // Never awaited, never allowed to throw: an exception raised synchronously
      // inside an 'abort' handler is an uncaught exception and would take down
      // the process.
      const onAbort = () => {
        void this.cancelBackend(pid).catch(() => {});
      };
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        return await tx.unsafe(sql);
      } finally {
        // Removed while this PID is provably still ours. PostgreSQL recycles
        // backend PIDs, so a listener surviving past the statement could cancel
        // an unrelated session's query.
        signal.removeEventListener('abort', onAbort);
      }
    });
    return result as unknown as Record<string, unknown>[];
  }

  /**
   * Cancels the given backend from a FRESH connection — a CancelRequest cannot
   * travel on the connection that is busy running the query. Never throws;
   * returns whether PostgreSQL reported the signal as delivered.
   *
   * Deliberately not postgres.js's built-in query.cancel(): its implementation
   * discards the promise returned by the canceller, so a transient error on the
   * cancel socket becomes an unhandled rejection — which by default terminates
   * the Node process.
   */
  private async cancelBackend(pid: number): Promise<boolean> {
    const cfg = this.config;
    if (!cfg) return false;
    // Reuses the same credentials, and a role may always cancel its own
    // backends, so this never fails on privileges.
    const admin = postgres({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      username: cfg.username,
      password: cfg.password,
      ssl: this.sslConfig(cfg),
      max: 1,
      connect_timeout: 5,
      idle_timeout: 1,
    });
    try {
      const [row] = await admin<{ cancelled: boolean }[]>`
        SELECT pg_cancel_backend(${pid}) AS cancelled
      `;
      return row?.cancelled === true;
    } catch (err) {
      console.warn('[postgres] pg_cancel_backend failed:', err);
      return false;
    } finally {
      await admin.end({ timeout: 2 }).catch(() => {});
    }
  }

  async executeParameterizedQuery(query: ParameterizedQuery): Promise<Record<string, unknown>[]> {
    if (!this.client) {
      throw new Error('Not connected to PostgreSQL');
    }
    // Use the postgres library's built-in parameterized query support.
    // postgres' ParameterOrJSON<never>[] generic is overly narrow for our
    // dynamic params (and rejects `undefined`); cast through unknown to the
    // concrete primitive union we actually pass.
    const result = await this.client.unsafe(
      query.sql,
      query.params as unknown as (string | number | boolean | null)[]
    );
    return result as Record<string, unknown>[];
  }

  async listSchemas(): Promise<string[]> {
    if (!this.client) {
      throw new Error('Not connected to PostgreSQL');
    }
    // User-visible namespaces: exclude PostgreSQL's internal catalogs.
    const rows = await this.client<{ schema_name: string }[]>`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('information_schema')
        AND schema_name NOT LIKE 'pg_%'
      ORDER BY schema_name
    `;
    return rows.map((r) => r.schema_name);
  }

  getTablesQuery(): ParameterizedQuery {
    return PostgreSQLQueries.tables(this.schemaName());
  }

  getColumnsQuery(tableName: string): ParameterizedQuery {
    return PostgreSQLQueries.columnsForTable(tableName, this.schemaName());
  }

  getForeignKeysQuery(tableName: string): ParameterizedQuery {
    return PostgreSQLQueries.foreignKeysForTable(tableName, this.schemaName());
  }
}
