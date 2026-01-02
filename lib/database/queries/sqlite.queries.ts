export const SQLiteQueries = {
  TABLES: `
    SELECT name as table_name
    FROM sqlite_master
    WHERE type = 'table'
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `,

  // SQLite uses PRAGMA for column info - these return different format
  // so we handle them specially in the adapter
  tableInfo: (tableName: string) => `PRAGMA table_info('${tableName}')`,
  foreignKeyList: (tableName: string) => `PRAGMA foreign_key_list('${tableName}')`,
};
