import Database from 'better-sqlite3';
import { BaseDatabaseAdapter } from '../base-adapter';
import type {
  AdapterConnectionConfig,
  DatabaseType,
  IntrospectionResult,
  ProgressCallback,
  ConnectionTestResult,
} from '../types';
import type { Column } from '@/models/column.interface';
import type { DatabaseTable } from '@/models/database-table.interface';
import { SQLiteQueries } from '../queries/sqlite.queries';

export class SQLiteAdapter extends BaseDatabaseAdapter {
  readonly type: DatabaseType = 'sqlite';
  readonly displayName = 'SQLite';
  readonly defaultPort = 0; // No port for SQLite

  private db: Database.Database | null = null;

  async connect(config: AdapterConnectionConfig): Promise<void> {
    if (!config.filepath) {
      throw new Error('SQLite requires a filepath');
    }

    // better-sqlite3 is synchronous
    this.db = new Database(config.filepath, { readonly: false });
    this.config = config;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.connected = false;
    this.config = null;
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

  // Override introspectSchema because SQLite uses PRAGMA with different result format
  async introspectSchema(onProgress?: ProgressCallback): Promise<IntrospectionResult> {
    if (!this.db) {
      throw new Error('Not connected to SQLite');
    }

    onProgress?.(10, 'Fetching table list...');

    // Get all tables
    const tablesResult = this.db
      .prepare(SQLiteQueries.TABLES)
      .all() as { table_name: string }[];

    const tables: DatabaseTable[] = [];

    for (let i = 0; i < tablesResult.length; i++) {
      const tableName = tablesResult[i].table_name;
      const progress = 10 + Math.floor((i / tablesResult.length) * 80);
      onProgress?.(progress, `Processing table ${i + 1}/${tablesResult.length}: ${tableName}`);

      // Get columns using PRAGMA table_info
      // Returns: cid, name, type, notnull, dflt_value, pk
      const columnsResult = this.db
        .prepare(SQLiteQueries.tableInfo(tableName))
        .all() as {
          cid: number;
          name: string;
          type: string;
          notnull: number;
          dflt_value: string | null;
          pk: number;
        }[];

      // Get foreign keys using PRAGMA foreign_key_list
      // Returns: id, seq, table, from, to, on_update, on_delete, match
      const fkResult = this.db
        .prepare(SQLiteQueries.foreignKeyList(tableName))
        .all() as {
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

  // These are not used for SQLite since we override introspectSchema
  getTablesQuery(): string {
    return SQLiteQueries.TABLES;
  }

  getColumnsQuery(tableName: string): string {
    return SQLiteQueries.tableInfo(tableName);
  }

  getForeignKeysQuery(tableName: string): string {
    return SQLiteQueries.foreignKeyList(tableName);
  }
}
