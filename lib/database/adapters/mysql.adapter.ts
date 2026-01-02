import mysql from 'mysql2/promise';
import type { Connection } from 'mysql2/promise';
import { BaseDatabaseAdapter } from '../base-adapter';
import type { AdapterConnectionConfig, DatabaseType } from '../types';
import { MySQLQueries } from '../queries/mysql.queries';

export class MySQLAdapter extends BaseDatabaseAdapter {
  readonly type: DatabaseType = 'mysql';
  readonly displayName = 'MySQL';
  readonly defaultPort = 3306;

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

    this.databaseName = config.database;
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
      throw new Error('Not connected to MySQL');
    }
    const [rows] = await this.client.execute(sql);
    return rows as Record<string, unknown>[];
  }

  getTablesQuery(): string {
    return MySQLQueries.tables(this.databaseName);
  }

  getColumnsQuery(tableName: string): string {
    return MySQLQueries.columnsForTable(this.databaseName, tableName);
  }

  getForeignKeysQuery(tableName: string): string {
    return MySQLQueries.foreignKeysForTable(this.databaseName, tableName);
  }

  // MySQL uses backticks for identifiers
  escapeIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }
}
