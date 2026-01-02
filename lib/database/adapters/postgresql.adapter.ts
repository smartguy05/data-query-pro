import postgres from 'postgres';
import { BaseDatabaseAdapter } from '../base-adapter';
import type { AdapterConnectionConfig, DatabaseType } from '../types';
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
    const result = await this.client.unsafe(sql);
    return result as Record<string, unknown>[];
  }

  getTablesQuery(): string {
    return PostgreSQLQueries.TABLES;
  }

  getColumnsQuery(tableName: string): string {
    return PostgreSQLQueries.columnsForTable(tableName);
  }

  getForeignKeysQuery(tableName: string): string {
    return PostgreSQLQueries.foreignKeysForTable(tableName);
  }
}
