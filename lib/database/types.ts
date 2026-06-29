import type { Column } from '@/models/column.interface';
import type { DatabaseTable } from '@/models/database-table.interface';
import type { ParameterizedQuery } from './queries/types';

// Re-export for convenience
export type { ParameterizedQuery } from './queries/types';

// Supported database types
export type DatabaseType = 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite';

/**
 * The default namespace ("schema") used when a connection doesn't specify one.
 * PostgreSQL/SQL Server have real namespaces; MySQL conflates schema with the
 * database name; SQLite has no namespace concept.
 */
export function defaultSchemaForType(type: DatabaseType | string | undefined): string | undefined {
  switch (type) {
    case 'postgresql':
      return 'public';
    case 'sqlserver':
      return 'dbo';
    default:
      return undefined;
  }
}

/** Whether a database type supports switching between multiple namespaces. */
export function supportsSchemaSwitching(type: DatabaseType | string | undefined): boolean {
  return type === 'postgresql' || type === 'sqlserver';
}

// Connection configuration for adapters
export interface AdapterConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  // Database namespace to introspect / query against (PostgreSQL/SQL Server
  // schema). When unset the adapter uses its default ("public" / "dbo").
  // For PostgreSQL the adapter also sets this as the connection search_path so
  // unqualified table names in generated SQL resolve to this schema.
  schema?: string;
  // SQLite-specific
  filepath?: string;
  // When true, the adapter must execute queries in a read-only context so that
  // even a statement that slips past the SQL validator cannot mutate data.
  // SQLite enforces this at connect time; pg/mysql/mssql wrap execution in a
  // read-only / always-rolled-back transaction. Internal callers that need
  // writes (e.g. schema introspection) leave this unset.
  readOnly?: boolean;
}

// Query execution result
export interface QueryResult {
  columns: string[];
  rows: (string | number | null)[][];
  rowCount: number;
  executionTime: number;
}

// Schema introspection result
export interface IntrospectionResult {
  tables: DatabaseTable[];
}

// Raw column data from introspection queries
export interface RawColumnData {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  foreign_key?: string;
  column_default?: string;
}

// Connection test result
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  serverVersion?: string;
  latencyMs?: number;
}

// Progress callback for long-running operations
export type ProgressCallback = (progress: number, message: string) => void;

// The main adapter interface that all database adapters must implement
export interface IDatabaseAdapter {
  // Metadata
  readonly type: DatabaseType;
  readonly displayName: string;
  readonly defaultPort: number;

  // Connection lifecycle
  connect(config: AdapterConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Core operations
  testConnection(config: AdapterConnectionConfig): Promise<ConnectionTestResult>;
  executeQuery(sql: string): Promise<QueryResult>;
  executeParameterizedQuery(query: ParameterizedQuery): Promise<Record<string, unknown>[]>;
  introspectSchema(onProgress?: ProgressCallback): Promise<IntrospectionResult>;
  /**
   * Lists the database namespaces ("schemas") available on this connection that
   * a user can introspect/query. Returns an empty array for databases without a
   * namespace concept (MySQL/SQLite). Must be called while connected.
   */
  listSchemas(): Promise<string[]>;

  // SQL dialect helpers
  escapeIdentifier(identifier: string): string;
  escapeLiteral(value: string): string;
}
