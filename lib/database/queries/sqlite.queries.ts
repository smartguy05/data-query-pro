import type { ParameterizedQuery, SQLiteQueryBuilder } from './types';

/**
 * SQLite queries using PRAGMA commands.
 * Note: PRAGMA commands don't support parameter binding directly,
 * so the adapter must validate table names before interpolation.
 * Table names are validated against the schema to prevent injection.
 */
export const SQLiteQueries: SQLiteQueryBuilder = {
  TABLES: `
    SELECT name as table_name
    FROM sqlite_master
    WHERE type = 'table'
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `,

  // SQLite PRAGMA table_info requires table name as identifier
  // The adapter will validate the table name before use
  tableInfo: (tableName: string): ParameterizedQuery => ({
    sql: `PRAGMA table_info(?)`,
    params: [tableName]
  }),

  foreignKeyList: (tableName: string): ParameterizedQuery => ({
    sql: `PRAGMA foreign_key_list(?)`,
    params: [tableName]
  }),
};
