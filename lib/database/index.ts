// Types
export type {
  DatabaseType,
  IDatabaseAdapter,
  AdapterConnectionConfig,
  QueryResult,
  IntrospectionResult,
  ConnectionTestResult,
  ProgressCallback,
  ExecuteOptions,
} from './types';

// Schema/namespace helpers (runtime values, not just types)
export { defaultSchemaForType, supportsSchemaSwitching } from './types';

// Dirty-read capability check. NOTE: client components must import this from
// '@/lib/database/types' directly, NOT from this barrel — the exports below pull
// in the adapter factory and with it mssql/better-sqlite3.
export { supportsDirtyRead } from './types';

// Factory
export { DatabaseAdapterFactory } from './factory';

// Base class (for custom extensions)
export { BaseDatabaseAdapter } from './base-adapter';

// Individual adapters (for direct use if needed)
export { PostgreSQLAdapter } from './adapters/postgresql.adapter';
export { MySQLAdapter } from './adapters/mysql.adapter';
export { SQLServerAdapter } from './adapters/sqlserver.adapter';
export { SQLiteAdapter } from './adapters/sqlite.adapter';
