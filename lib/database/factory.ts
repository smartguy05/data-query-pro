import type { DatabaseType, IDatabaseAdapter } from './types';
import { PostgreSQLAdapter } from './adapters/postgresql.adapter';
import { MySQLAdapter } from './adapters/mysql.adapter';
import { SQLServerAdapter } from './adapters/sqlserver.adapter';
import { SQLiteAdapter } from './adapters/sqlite.adapter';

type AdapterConstructor = new () => IDatabaseAdapter;

export class DatabaseAdapterFactory {
  private static adapters: Map<DatabaseType, AdapterConstructor> = new Map([
    ['postgresql', PostgreSQLAdapter],
    ['mysql', MySQLAdapter],
    ['sqlserver', SQLServerAdapter],
    ['sqlite', SQLiteAdapter],
  ]);

  /**
   * Create a new adapter instance for the given database type
   */
  static create(type: DatabaseType): IDatabaseAdapter {
    const AdapterClass = this.adapters.get(type);
    if (!AdapterClass) {
      throw new Error(`Unsupported database type: ${type}`);
    }
    return new AdapterClass();
  }

  /**
   * Check if a database type is supported
   */
  static isSupported(type: string): type is DatabaseType {
    return this.adapters.has(type as DatabaseType);
  }

  /**
   * Get list of all supported database types
   */
  static getSupportedTypes(): DatabaseType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get default port for a database type
   */
  static getDefaultPort(type: DatabaseType): number {
    const adapter = this.create(type);
    return adapter.defaultPort;
  }

  /**
   * Get display name for a database type
   */
  static getDisplayName(type: DatabaseType): string {
    const adapter = this.create(type);
    return adapter.displayName;
  }

  /**
   * Register a custom adapter (for extensibility)
   */
  static register(type: DatabaseType, adapterClass: AdapterConstructor): void {
    this.adapters.set(type, adapterClass);
  }
}
