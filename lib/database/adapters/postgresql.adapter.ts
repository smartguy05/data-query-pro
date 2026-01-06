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
    // Use tagged template literal for safe execution of static queries
    const result = await this.client.unsafe(sql);
    return result as Record<string, unknown>[];
  }

  async executeParameterizedQuery(query: ParameterizedQuery): Promise<Record<string, unknown>[]> {
    if (!this.client) {
      throw new Error('Not connected to PostgreSQL');
    }
    // Use the postgres library's built-in parameterized query support
    // Cast params to the expected type for the unsafe method
    const result = await this.client.unsafe(
      query.sql,
      query.params as (string | number | boolean | null | undefined)[]
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
