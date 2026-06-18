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

  async executeRawQuery(sql: string): Promise<Record<string, unknown>[]> {
    if (!this.client) {
      throw new Error('Not connected to PostgreSQL');
    }
    if (this.readOnly) {
      // Wrap in a READ ONLY transaction: any write (including via functions)
      // fails with "cannot execute ... in a read-only transaction". Committing
      // a read-only transaction is harmless.
      const result = await this.client.begin('read only', (tx) => tx.unsafe(sql));
      return result as unknown as Record<string, unknown>[];
    }
    // Use tagged template literal for safe execution of static queries
    const result = await this.client.unsafe(sql);
    return result as Record<string, unknown>[];
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

  getTablesQuery(): string {
    return PostgreSQLQueries.TABLES;
  }

  getColumnsQuery(tableName: string): ParameterizedQuery {
    return PostgreSQLQueries.columnsForTable(tableName);
  }

  getForeignKeysQuery(tableName: string): ParameterizedQuery {
    return PostgreSQLQueries.foreignKeysForTable(tableName);
  }
}
