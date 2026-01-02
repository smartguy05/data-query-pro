import sql from 'mssql';
import { BaseDatabaseAdapter } from '../base-adapter';
import type { AdapterConnectionConfig, DatabaseType } from '../types';
import { SQLServerQueries } from '../queries/sqlserver.queries';

export class SQLServerAdapter extends BaseDatabaseAdapter {
  readonly type: DatabaseType = 'sqlserver';
  readonly displayName = 'Microsoft SQL Server';
  readonly defaultPort = 1433;

  private pool: sql.ConnectionPool | null = null;

  async connect(config: AdapterConnectionConfig): Promise<void> {
    this.pool = await sql.connect({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: {
        encrypt: config.ssl !== false,
        trustServerCertificate: true,
      },
    });

    this.config = config;
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

  async executeRawQuery(sqlQuery: string): Promise<Record<string, unknown>[]> {
    if (!this.pool) {
      throw new Error('Not connected to SQL Server');
    }
    const result = await this.pool.request().query(sqlQuery);
    return result.recordset as Record<string, unknown>[];
  }

  getTablesQuery(): string {
    return SQLServerQueries.TABLES;
  }

  getColumnsQuery(tableName: string): string {
    return SQLServerQueries.columnsForTable(tableName);
  }

  getForeignKeysQuery(tableName: string): string {
    return SQLServerQueries.foreignKeysForTable(tableName);
  }

  // SQL Server uses square brackets for identifiers
  escapeIdentifier(identifier: string): string {
    return `[${identifier.replace(/\]/g, ']]')}]`;
  }
}
