// Types
export type {
  DatabaseType,
  IDatabaseAdapter,
  AdapterConnectionConfig,
  QueryResult,
  IntrospectionResult,
  ConnectionTestResult,
  ProgressCallback,
} from './types';

// Factory
export { DatabaseAdapterFactory } from './factory';

// Base class (for custom extensions)
export { BaseDatabaseAdapter } from './base-adapter';

// Individual adapters (for direct use if needed)
export { PostgreSQLAdapter } from './adapters/postgresql.adapter';
export { MySQLAdapter } from './adapters/mysql.adapter';
export { SQLServerAdapter } from './adapters/sqlserver.adapter';
export { SQLiteAdapter } from './adapters/sqlite.adapter';
