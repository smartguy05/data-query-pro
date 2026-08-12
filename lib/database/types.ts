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

/**
 * Whether a database type has a real dirty-read (READ UNCOMMITTED) mode, i.e.
 * whether `AdapterConnectionConfig.dirtyRead` does anything on it.
 *
 * - SQL Server: yes — the transaction-scoped equivalent of `WITH (NOLOCK)`.
 * - MySQL: yes — `SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED`.
 * - PostgreSQL: no — it accepts READ UNCOMMITTED only as a synonym for READ
 *   COMMITTED, and under MVCC readers never block writers, so there is nothing
 *   to opt out of.
 * - SQLite: no — `PRAGMA read_uncommitted` only has an effect in shared-cache
 *   mode, which better-sqlite3 never enables.
 *
 * Shared by the execute route (to report back honestly) and the UI (to say the
 * setting is a no-op on the current connection). Kept in this driver-free module
 * precisely so the client can import it without pulling in adapter code.
 */
export function supportsDirtyRead(type: DatabaseType | string | undefined): boolean {
  return type === 'mysql' || type === 'sqlserver';
}

/**
 * Whether a running query on this database type can be cancelled.
 *
 * False only for SQLite, and for two independent reasons: better-sqlite3 exposes
 * no sqlite3_interrupt binding, and its execution is synchronous, so while a query
 * runs the Node event loop is blocked and the server cannot even receive a cancel
 * request. The client uses this to hide the Cancel button rather than offer one
 * that silently does nothing.
 *
 * Mirrors adapter.supportsCancellation, but usable from client components — this
 * module is driver-free, unlike the '@/lib/database' barrel.
 */
export function supportsQueryCancellation(type: DatabaseType | string | undefined): boolean {
  return type !== 'sqlite';
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
  // When true, the adapter lowers the isolation level of the read-only
  // transaction it already opens to READ UNCOMMITTED, so the query never waits
  // on other transactions' locks. This is the portable form of SQL Server's
  // `WITH (NOLOCK)`: it applies to every table, view and subquery at once and
  // never touches the SQL text (the AST validator rejects `SET TRANSACTION
  // ISOLATION LEVEL ...` in user SQL anyway).
  //
  // Composes with `readOnly` rather than replacing it — isolation governs what a
  // query can *see*, never what it can write. Only MySQL and SQL Server act on
  // it; see `supportsDirtyRead()` above.
  //
  // Deliberately NOT set for schema introspection: half-committed DDL leaking
  // into the schema graph would poison the OpenAI vector store, and every query
  // generated from it, for the life of the cached schema.
  dirtyRead?: boolean;
}

/**
 * Per-execution options for a single query. Additive and optional so every
 * existing caller (executeParameterizedQuery, introspectSchema, the eval
 * harness) is unaffected.
 */
export interface ExecuteOptions {
  /**
   * Aborting this signal cancels the query *on the database* — PostgreSQL
   * `pg_cancel_backend`, MySQL `KILL QUERY`, SQL Server request cancellation.
   * Adapters that cannot do this (SQLite) ignore it; check
   * `supportsCancellation` before promising a user it will work.
   */
  signal?: AbortSignal;
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
  /**
   * Whether `executeQuery`'s `options.signal` can actually stop work already
   * running on the database. False for SQLite, whose driver is synchronous and
   * exposes no interrupt — defaults to false in BaseDatabaseAdapter so a new
   * adapter is presumed uncancellable until it proves otherwise.
   */
  readonly supportsCancellation: boolean;

  // Connection lifecycle
  connect(config: AdapterConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Core operations
  testConnection(config: AdapterConnectionConfig): Promise<ConnectionTestResult>;
  executeQuery(sql: string, options?: ExecuteOptions): Promise<QueryResult>;
  executeParameterizedQuery(query: ParameterizedQuery): Promise<Record<string, unknown>[]>;
  introspectSchema(
    onProgress?: ProgressCallback,
    options?: ExecuteOptions
  ): Promise<IntrospectionResult>;
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
