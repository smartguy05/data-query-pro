export const PostgreSQLQueries = {
  TABLES: `
    SELECT tablename as table_name
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `,

  columnsForTable: (tableName: string) => `
    SELECT
      a.attname as column_name,
      pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
      NOT a.attnotnull as is_nullable,
      pg_catalog.pg_get_expr(d.adbin, d.adrelid) as column_default,
      CASE WHEN pk.attname IS NOT NULL THEN true ELSE false END as is_primary_key
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
    JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
    LEFT JOIN pg_catalog.pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    LEFT JOIN (
      SELECT i.indrelid, unnest(i.indkey) as attnum, a.attname
      FROM pg_catalog.pg_index i
      JOIN pg_catalog.pg_attribute a ON i.indexrelid = a.attrelid
      WHERE i.indisprimary
    ) pk ON a.attrelid = pk.indrelid AND a.attnum = pk.attnum
    WHERE c.relname = '${tableName}'
    AND n.nspname = 'public'
    AND a.attnum > 0
    AND NOT a.attisdropped
    ORDER BY a.attnum
  `,

  foreignKeysForTable: (tableName: string) => `
    SELECT
      a.attname as column_name,
      fc.relname as foreign_table_name,
      fa.attname as foreign_column_name
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class c ON con.conrelid = c.oid
    JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
    JOIN pg_catalog.pg_class fc ON con.confrelid = fc.oid
    JOIN pg_catalog.pg_attribute fa ON fa.attrelid = fc.oid AND fa.attnum = ANY(con.confkey)
    WHERE c.relname = '${tableName}'
    AND n.nspname = 'public'
    AND con.contype = 'f'
  `,
};
