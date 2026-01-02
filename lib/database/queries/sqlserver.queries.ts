export const SQLServerQueries = {
  TABLES: `
    SELECT t.name as table_name
    FROM sys.tables t
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'dbo'
    ORDER BY t.name
  `,

  columnsForTable: (tableName: string) => `
    SELECT
      c.name as column_name,
      ty.name + CASE
        WHEN ty.name IN ('varchar', 'nvarchar', 'char', 'nchar', 'binary', 'varbinary')
          THEN '(' + CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length AS VARCHAR) END + ')'
        WHEN ty.name IN ('decimal', 'numeric')
          THEN '(' + CAST(c.precision AS VARCHAR) + ',' + CAST(c.scale AS VARCHAR) + ')'
        ELSE ''
      END as data_type,
      c.is_nullable as is_nullable,
      dc.definition as column_default,
      CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END as is_primary_key
    FROM sys.columns c
    INNER JOIN sys.tables t ON c.object_id = t.object_id
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
    LEFT JOIN (
      SELECT ic.object_id, ic.column_id
      FROM sys.index_columns ic
      INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      WHERE i.is_primary_key = 1
    ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
    WHERE t.name = '${tableName}' AND s.name = 'dbo'
    ORDER BY c.column_id
  `,

  foreignKeysForTable: (tableName: string) => `
    SELECT
      COL_NAME(fkc.parent_object_id, fkc.parent_column_id) as column_name,
      OBJECT_NAME(fkc.referenced_object_id) as foreign_table_name,
      COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) as foreign_column_name
    FROM sys.foreign_key_columns fkc
    INNER JOIN sys.tables t ON fkc.parent_object_id = t.object_id
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.name = '${tableName}' AND s.name = 'dbo'
  `,
};
