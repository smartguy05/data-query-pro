/**
 * Parameterized query interface for SQL injection prevention.
 * All dynamic values should be passed as params, not interpolated into SQL strings.
 */
export interface ParameterizedQuery {
  /** SQL query with placeholders for parameters */
  sql: string;
  /** Parameter values to substitute for placeholders */
  params: unknown[];
}

/**
 * Query builder interface that all database query modules should implement.
 * Queries that need dynamic values return ParameterizedQuery objects.
 */
export interface QueryBuilder {
  /** Static query for fetching all tables */
  TABLES: string;
  /** Parameterized query for columns of a specific table */
  columnsForTable(tableName: string): ParameterizedQuery;
  /** Parameterized query for foreign keys of a specific table */
  foreignKeysForTable(tableName: string): ParameterizedQuery;
}

/**
 * MySQL-specific query builder that also needs database name
 */
export interface MySQLQueryBuilder {
  /** Parameterized query for tables in a database */
  tables(databaseName: string): ParameterizedQuery;
  /** Parameterized query for columns of a specific table */
  columnsForTable(databaseName: string, tableName: string): ParameterizedQuery;
  /** Parameterized query for foreign keys of a specific table */
  foreignKeysForTable(databaseName: string, tableName: string): ParameterizedQuery;
}

/**
 * SQLite-specific query builder using PRAGMA commands
 */
export interface SQLiteQueryBuilder {
  /** Static query for fetching all tables */
  TABLES: string;
  /** Parameterized query for table column info */
  tableInfo(tableName: string): ParameterizedQuery;
  /** Parameterized query for foreign key list */
  foreignKeyList(tableName: string): ParameterizedQuery;
}
