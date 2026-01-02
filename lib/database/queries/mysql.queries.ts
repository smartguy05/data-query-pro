export const MySQLQueries = {
  tables: (databaseName: string) => `
    SELECT TABLE_NAME as table_name
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = '${databaseName}'
    AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `,

  columnsForTable: (databaseName: string, tableName: string) => `
    SELECT
      COLUMN_NAME as column_name,
      COLUMN_TYPE as data_type,
      CASE WHEN IS_NULLABLE = 'YES' THEN 1 ELSE 0 END as is_nullable,
      COLUMN_DEFAULT as column_default,
      CASE WHEN COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END as is_primary_key
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '${databaseName}'
    AND TABLE_NAME = '${tableName}'
    ORDER BY ORDINAL_POSITION
  `,

  foreignKeysForTable: (databaseName: string, tableName: string) => `
    SELECT
      COLUMN_NAME as column_name,
      REFERENCED_TABLE_NAME as foreign_table_name,
      REFERENCED_COLUMN_NAME as foreign_column_name
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = '${databaseName}'
    AND TABLE_NAME = '${tableName}'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  `,
};
