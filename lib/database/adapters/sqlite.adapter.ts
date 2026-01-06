import Database from 'better-sqlite3';
import { BaseDatabaseAdapter } from '../base-adapter';
import type {
  AdapterConnectionConfig,
  DatabaseType,
  IntrospectionResult,
  ProgressCallback,
  ConnectionTestResult,
  ParameterizedQuery,
} from '../types';
import type { Column } from '@/models/column.interface';
import type { DatabaseTable } from '@/models/database-table.interface';
import { SQLiteQueries } from '../queries/sqlite.queries';

export class SQLiteAdapter extends BaseDatabaseAdapter {
  readonly type: DatabaseType = 'sqlite';
  readonly displayName = 'SQLite';
  readonly defaultPort = 0; // No port for SQLite

  private db: Database.Database | null = null;
  // Cache valid table names for validation
  private validTableNames: Set<string> = new Set();

  async connect(config: AdapterConnectionConfig): Promise<void> {
    if (!config.filepath) {
      throw new Error('SQLite requires a filepath');
    }

    // better-sqlite3 is synchronous
    this.db = new Database(config.filepath, { readonly: false });
    this.config = config;
    this.connected = true;

    // Pre-cache valid table names for SQL injection prevention
    await this.refreshValidTableNames();
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.validTableNames.clear();
    this.connected = false;
    this.config = null;
  }

  private async refreshValidTableNames(): Promise<void> {
    if (!this.db) return;

    const tables = this.db
      .prepare(SQLiteQueries.TABLES)
      .all() as { table_name: string }[];

    this.validTableNames = new Set(tables.map(t => t.table_name));
  }

  /**
   * Validates that a table name exists in the database.
   * This prevents SQL injection by ensuring only valid table names are used.
   */
  private validateTableName(tableName: string): void {
    if (!this.validTableNames.has(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
  }

  /**
   * Escapes a table name for use in SQLite PRAGMA commands.
   * Only allows alphanumeric characters and underscores.
   */
  private escapePragmaTableName(tableName: string): string {
    // Validate table name contains only safe characters
    if (!/^[\w]+$/.test(tableName)) {
      throw new Error(`Invalid table name format: ${tableName}`);
    }
    // Double-quote and escape for safety
    return `"${tableName.replace(/"/g, '""')}"`;
  }

  async testConnection(config: AdapterConnectionConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      if (!config.filepath) {
        return {
          success: false,
          message: 'SQLite requires a filepath',
        };
      }

      // Try to open the database
      const testDb = new Database(config.filepath, { readonly: true });
      testDb.close();

      const latencyMs = Date.now() - startTime;
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

  async executeRawQuery(sql: string): Promise<Record<string, unknown>[]> {
    if (!this.db) {
      throw new Error('Not connected to SQLite');
    }
    // better-sqlite3 is synchronous
    try {
      const stmt = this.db.prepare(sql);
      // Check if it's a SELECT query
      if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('PRAGMA')) {
        return stmt.all() as Record<string, unknown>[];
      } else {
        stmt.run();
        return [];
      }
    } catch (error) {
      throw error;
    }
  }

  async executeParameterizedQuery(query: ParameterizedQuery): Promise<Record<string, unknown>[]> {
    if (!this.db) {
      throw new Error('Not connected to SQLite');
    }

    // For PRAGMA commands, we need to validate and escape the table name
    // since PRAGMA doesn't support parameter binding
    if (query.sql.trim().toUpperCase().startsWith('PRAGMA')) {
      // Validate the table name parameter
      const tableName = query.params[0] as string;
      this.validateTableName(tableName);

      // Build the PRAGMA command with escaped table name
      const escapedTableName = this.escapePragmaTableName(tableName);
      let pragmaQuery: string;

      if (query.sql.includes('table_info')) {
        pragmaQuery = `PRAGMA table_info(${escapedTableName})`;
      } else if (query.sql.includes('foreign_key_list')) {
        pragmaQuery = `PRAGMA foreign_key_list(${escapedTableName})`;
      } else {
        throw new Error('Unsupported PRAGMA command');
      }

      const stmt = this.db.prepare(pragmaQuery);
      return stmt.all() as Record<string, unknown>[];
    }

    // For regular queries, use better-sqlite3's built-in parameter binding
    const stmt = this.db.prepare(query.sql);
    return stmt.all(...query.params) as Record<string, unknown>[];
  }

  // Override introspectSchema because SQLite uses PRAGMA with different result format
  async introspectSchema(onProgress?: ProgressCallback): Promise<IntrospectionResult> {
    if (!this.db) {
      throw new Error('Not connected to SQLite');
    }

    onProgress?.(10, 'Fetching table list...');

    // Refresh valid table names cache
    await this.refreshValidTableNames();

    // Get all tables
    const tablesResult = this.db
      .prepare(SQLiteQueries.TABLES)
      .all() as { table_name: string }[];

    const tables: DatabaseTable[] = [];

    for (let i = 0; i < tablesResult.length; i++) {
      const tableName = tablesResult[i].table_name;
      const progress = 10 + Math.floor((i / tablesResult.length) * 80);
      onProgress?.(progress, `Processing table ${i + 1}/${tablesResult.length}: ${tableName}`);

      // Use parameterized queries (which validate table names)
      const columnsQuery = this.getColumnsQuery(tableName);
      const columnsResult = await this.executeParameterizedQuery(columnsQuery) as {
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }[];

      const fkQuery = this.getForeignKeysQuery(tableName);
      const fkResult = await this.executeParameterizedQuery(fkQuery) as {
        id: number;
        seq: number;
        table: string;
        from: string;
        to: string;
      }[];

      const fkMap = new Map<string, string>();
      fkResult.forEach((fk) => {
        fkMap.set(fk.from, `${fk.table}.${fk.to}`);
      });

      const columns: Column[] = columnsResult.map((col) => ({
        name: col.name,
        type: col.type || 'TEXT',
        nullable: col.notnull === 0,
        primary_key: col.pk === 1,
        foreign_key: fkMap.get(col.name),
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

  // These are used by the base adapter but we handle them specially
  getTablesQuery(): string {
    return SQLiteQueries.TABLES;
  }

  getColumnsQuery(tableName: string): ParameterizedQuery {
    return SQLiteQueries.tableInfo(tableName);
  }

  getForeignKeysQuery(tableName: string): ParameterizedQuery {
    return SQLiteQueries.foreignKeyList(tableName);
  }
}
