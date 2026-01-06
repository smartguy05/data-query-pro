import type { Column } from '@/models/column.interface';
import type { DatabaseTable } from '@/models/database-table.interface';
import type { ParameterizedQuery } from './queries/types';

// Re-export for convenience
export type { ParameterizedQuery } from './queries/types';

// Supported database types
export type DatabaseType = 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite';

// Connection configuration for adapters
export interface AdapterConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  // SQLite-specific
  filepath?: string;
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

  // SQL dialect helpers
  escapeIdentifier(identifier: string): string;
  escapeLiteral(value: string): string;
}
