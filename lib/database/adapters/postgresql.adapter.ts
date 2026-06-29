import postgres from 'postgres';
import { BaseDatabaseAdapter } from '../base-adapter';
import type { AdapterConnectionConfig, DatabaseType, ParameterizedQuery } from '../types';
import { PostgreSQLQueries } from '../queries/postgresql.queries';

export class PostgreSQLAdapter extends BaseDatabaseAdapter {
  readonly type: DatabaseType = 'postgresql';
  readonly displayName = 'PostgreSQL';
  readonly defaultPort = 5432;

  private client: ReturnType<typeof postgres> | null = null;

  async connect(config: AdapterConnectionConfig): Promise<void> {
    const sslConfig = config.host.includes('azure')
      ? { rejectUnauthorized: false }
      : config.ssl === true
        ? { rejectUnauthorized: false }
        : config.ssl || false;

    this.client = postgres({
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      ssl: sslConfig,
    });

    // Test connection with a simple query
    await this.client`SELECT 1`;
    this.config = config;
    this.readOnly = !!config.readOnly;
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

  async executeRawQuery(sql: string): Promise<Record<string, unknown>[]> {
    if (!this.client) {
      throw new Error('Not connected to PostgreSQL');
    }
    const searchPath = this.searchPath();
    // set_config with is_local=true scopes search_path to this transaction only,
    // guaranteeing it applies to the same pooled connection that runs `sql`
    // (a connect-time SET would not, since the pool hands out other connections).
    if (this.readOnly) {
      // Wrap in a READ ONLY transaction: any write (including via functions)
      // fails with "cannot execute ... in a read-only transaction". Committing
      // a read-only transaction is harmless.
      const result = await this.client.begin('read only', async (tx) => {
        await tx`SELECT set_config('search_path', ${searchPath}, true)`;
        return tx.unsafe(sql);
      });
      return result as unknown as Record<string, unknown>[];
    }
    const result = await this.client.begin(async (tx) => {
      await tx`SELECT set_config('search_path', ${searchPath}, true)`;
      return tx.unsafe(sql);
    });
    return result as unknown as Record<string, unknown>[];
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
