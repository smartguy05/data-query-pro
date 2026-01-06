import mysql from 'mysql2/promise';
import type { Connection } from 'mysql2/promise';
import { BaseDatabaseAdapter } from '../base-adapter';
import type { AdapterConnectionConfig, DatabaseType, ParameterizedQuery, IntrospectionResult, ProgressCallback } from '../types';
import { MySQLQueries } from '../queries/mysql.queries';

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
  async introspectSchema(onProgress?: ProgressCallback): Promise<IntrospectionResult> {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }

    onProgress?.(10, 'Fetching table list...');

    // Use parameterized query for tables
    const tablesQuery = MySQLQueries.tables(this.databaseName);
    const tablesResult = await this.executeParameterizedQuery(tablesQuery);
    const tableNames = tablesResult.map((row) => row.table_name as string);

    const tables: { name: string; columns: Column[]; description?: string; aiDescription?: string }[] = [];

    for (let i = 0; i < tableNames.length; i++) {
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
