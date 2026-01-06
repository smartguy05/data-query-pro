import type {
  IDatabaseAdapter,
  DatabaseType,
  AdapterConnectionConfig,
  QueryResult,
  IntrospectionResult,
  ConnectionTestResult,
  ProgressCallback,
  ParameterizedQuery,
} from './types';
import type { DatabaseTable } from '@/models/database-table.interface';
import type { Column } from '@/models/column.interface';

export abstract class BaseDatabaseAdapter implements IDatabaseAdapter {
  abstract readonly type: DatabaseType;
  abstract readonly displayName: string;
  abstract readonly defaultPort: number;

  protected connected: boolean = false;
  protected config: AdapterConnectionConfig | null = null;

  // Abstract methods that each adapter must implement
  abstract connect(config: AdapterConnectionConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract executeRawQuery(sql: string): Promise<Record<string, unknown>[]>;
  abstract executeParameterizedQuery(query: ParameterizedQuery): Promise<Record<string, unknown>[]>;
  abstract getTablesQuery(): string;
  abstract getColumnsQuery(tableName: string): ParameterizedQuery;
  abstract getForeignKeysQuery(tableName: string): ParameterizedQuery;

  // Common implementation
  isConnected(): boolean {
    return this.connected;
  }

  async testConnection(config: AdapterConnectionConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      await this.connect(config);
      const latencyMs = Date.now() - startTime;
      await this.disconnect();
      return {
        success: true,
        message: 'Connection successful',
        latencyMs,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }

    const startTime = Date.now();
    const result = await this.executeRawQuery(sql);
    const executionTime = Date.now() - startTime;

    const columns = result.length > 0 ? Object.keys(result[0]) : [];
    const rows = result.map((row) =>
      columns.map((col) => {
        const value = row[col];
        if (value === null || value === undefined) return null;
        if (value instanceof Date) return value.toISOString().split('T')[0];
        if (typeof value === 'number') return value;
        return String(value);
      })
    );

    return {
      columns,
      rows,
      rowCount: result.length,
      executionTime,
    };
  }

  async introspectSchema(onProgress?: ProgressCallback): Promise<IntrospectionResult> {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }

    onProgress?.(10, 'Fetching table list...');

    const tablesResult = await this.executeRawQuery(this.getTablesQuery());
    const tableNames = tablesResult.map((row) => row.table_name as string);

    const tables: DatabaseTable[] = [];

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

  // Default implementations (can be overridden)
  escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  escapeLiteral(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }
}
