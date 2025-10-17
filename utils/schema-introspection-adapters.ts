import postgres from "postgres"
import mysql from "mysql2/promise"
import sql from "mssql"
import Database from "better-sqlite3"

interface DatabaseConnection {
  type: "postgresql" | "mysql" | "sqlserver" | "sqlite"
  host: string
  port: string
  database: string
  username: string
  password: string
}

interface SchemaTable {
  name: string
  columns: SchemaColumn[]
  description: string | null
  aiDescription: string | null
}

interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
  primary_key: boolean
  foreign_key?: string
  description: string | null
  aiDescription: string | null
}

export interface Schema {
  tables: SchemaTable[]
}

export async function introspectSchema(
  connection: DatabaseConnection,
  updateProgress: (progress: number, message: string) => void,
): Promise<Schema> {
  switch (connection.type) {
    case "postgresql":
      return introspectPostgreSQLSchema(connection, updateProgress)
    case "mysql":
      return introspectMySQLSchema(connection, updateProgress)
    case "sqlserver":
      return introspectSQLServerSchema(connection, updateProgress)
    case "sqlite":
      return introspectSQLiteSchema(connection, updateProgress)
    default:
      throw new Error(`Unsupported database type: ${connection.type}`)
  }
}

async function introspectPostgreSQLSchema(
  connection: DatabaseConnection,
  updateProgress: (progress: number, message: string) => void,
): Promise<Schema> {
  const pgClient = postgres({
    host: connection.host,
    port: Number.parseInt(connection.port),
    database: connection.database,
    username: connection.username,
    password: connection.password,
    ssl: connection.host.includes("azure") ? { rejectUnauthorized: false } : false,
  })

  try {
    updateProgress(25, "Fetching table information...")

    const tables = await pgClient`
      SELECT
        t.tablename as table_name
      FROM pg_catalog.pg_tables t
      WHERE t.schemaname = 'public'
      ORDER BY t.tablename
    `

    const totalTables = tables.length
    const schema: Schema = { tables: [] }

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i]
      const progress = 25 + Math.floor((i / totalTables) * 60)

      updateProgress(progress, `Processing table ${i + 1}/${totalTables}: ${table.table_name}`)

      const columns = await pgClient`
        SELECT
          a.attname as column_name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
          NOT a.attnotnull as is_nullable,
          CASE WHEN pk.attname IS NOT NULL THEN true ELSE false END as is_primary_key
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
        JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
        LEFT JOIN (
          SELECT i.indrelid, unnest(i.indkey) as attnum, a.attname
          FROM pg_catalog.pg_index i
          JOIN pg_catalog.pg_attribute a ON i.indexrelid = a.attrelid
          WHERE i.indisprimary
        ) pk ON a.attrelid = pk.indrelid AND a.attnum = pk.attnum
        WHERE c.relname = ${table.table_name}
        AND n.nspname = 'public'
        AND a.attnum > 0
        AND NOT a.attisdropped
        ORDER BY a.attnum
      `

      const foreignKeys = await pgClient`
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
        WHERE c.relname = ${table.table_name}
        AND n.nspname = 'public'
        AND con.contype = 'f'
      `

      const fkMap = new Map()
      foreignKeys.forEach((fk: any) => {
        fkMap.set(fk.column_name, `${fk.foreign_table_name}.${fk.foreign_column_name}`)
      })

      const processedColumns = columns.map((col: any) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable,
        primary_key: col.is_primary_key,
        foreign_key: fkMap.get(col.column_name) || undefined,
        description: null,
        aiDescription: null,
      }))

      schema.tables.push({
        name: table.table_name,
        columns: processedColumns,
        description: null,
        aiDescription: null,
      })
    }

    return schema
  } finally {
    await pgClient.end()
  }
}

async function introspectMySQLSchema(
  connection: DatabaseConnection,
  updateProgress: (progress: number, message: string) => void,
): Promise<Schema> {
  const mysqlConnection = await mysql.createConnection({
    host: connection.host,
    port: Number.parseInt(connection.port),
    database: connection.database,
    user: connection.username,
    password: connection.password,
  })

  try {
    updateProgress(25, "Fetching table information...")

    const [tables] = await mysqlConnection.query(
      `SELECT TABLE_NAME as table_name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [connection.database],
    )

    const tableList = tables as any[]
    const totalTables = tableList.length
    const schema: Schema = { tables: [] }

    for (let i = 0; i < tableList.length; i++) {
      const table = tableList[i]
      const progress = 25 + Math.floor((i / totalTables) * 60)

      updateProgress(progress, `Processing table ${i + 1}/${totalTables}: ${table.table_name}`)

      const [columns] = await mysqlConnection.query(
        `SELECT
          COLUMN_NAME as column_name,
          COLUMN_TYPE as data_type,
          IS_NULLABLE as is_nullable,
          COLUMN_KEY as column_key
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION`,
        [connection.database, table.table_name],
      )

      const [foreignKeys] = await mysqlConnection.query(
        `SELECT
          COLUMN_NAME as column_name,
          REFERENCED_TABLE_NAME as foreign_table_name,
          REFERENCED_COLUMN_NAME as foreign_column_name
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
        [connection.database, table.table_name],
      )

      const fkMap = new Map()
      ;(foreignKeys as any[]).forEach((fk: any) => {
        fkMap.set(fk.column_name, `${fk.foreign_table_name}.${fk.foreign_column_name}`)
      })

      const processedColumns = (columns as any[]).map((col: any) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === "YES",
        primary_key: col.column_key === "PRI",
        foreign_key: fkMap.get(col.column_name) || undefined,
        description: null,
        aiDescription: null,
      }))

      schema.tables.push({
        name: table.table_name,
        columns: processedColumns,
        description: null,
        aiDescription: null,
      })
    }

    return schema
  } finally {
    await mysqlConnection.end()
  }
}

async function introspectSQLServerSchema(
  connection: DatabaseConnection,
  updateProgress: (progress: number, message: string) => void,
): Promise<Schema> {
  const config: sql.config = {
    server: connection.host,
    port: Number.parseInt(connection.port),
    database: connection.database,
    user: connection.username,
    password: connection.password,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  }

  const pool = new sql.ConnectionPool(config)

  try {
    await pool.connect()
    updateProgress(25, "Fetching table information...")

    const tablesResult = await pool.request().query(`
      SELECT TABLE_NAME as table_name
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG = '${connection.database}'
      ORDER BY TABLE_NAME
    `)

    const tables = tablesResult.recordset
    const totalTables = tables.length
    const schema: Schema = { tables: [] }

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i]
      const progress = 25 + Math.floor((i / totalTables) * 60)

      updateProgress(progress, `Processing table ${i + 1}/${totalTables}: ${table.table_name}`)

      const columnsResult = await pool.request().query(`
        SELECT
          c.COLUMN_NAME as column_name,
          c.DATA_TYPE as data_type,
          c.IS_NULLABLE as is_nullable,
          CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as is_primary_key
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN (
          SELECT ku.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND ku.TABLE_NAME = '${table.table_name}'
        ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
        WHERE c.TABLE_NAME = '${table.table_name}'
        ORDER BY c.ORDINAL_POSITION
      `)

      const foreignKeysResult = await pool.request().query(`
        SELECT
          fk.name as fk_name,
          c1.name as column_name,
          OBJECT_NAME(fk.referenced_object_id) as foreign_table_name,
          c2.name as foreign_column_name
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        JOIN sys.columns c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
        JOIN sys.columns c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id
        WHERE OBJECT_NAME(fk.parent_object_id) = '${table.table_name}'
      `)

      const fkMap = new Map()
      foreignKeysResult.recordset.forEach((fk: any) => {
        fkMap.set(fk.column_name, `${fk.foreign_table_name}.${fk.foreign_column_name}`)
      })

      const processedColumns = columnsResult.recordset.map((col: any) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === "YES",
        primary_key: col.is_primary_key === 1,
        foreign_key: fkMap.get(col.column_name) || undefined,
        description: null,
        aiDescription: null,
      }))

      schema.tables.push({
        name: table.table_name,
        columns: processedColumns,
        description: null,
        aiDescription: null,
      })
    }

    return schema
  } finally {
    await pool.close()
  }
}

async function introspectSQLiteSchema(
  connection: DatabaseConnection,
  updateProgress: (progress: number, message: string) => void,
): Promise<Schema> {
  // For SQLite, the database field contains the file path
  const db = new Database(connection.database)

  try {
    updateProgress(25, "Fetching table information...")

    const tables = db
      .prepare(
        `SELECT name as table_name
         FROM sqlite_master
         WHERE type='table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
      )
      .all() as any[]

    const totalTables = tables.length
    const schema: Schema = { tables: [] }

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i]
      const progress = 25 + Math.floor((i / totalTables) * 60)

      updateProgress(progress, `Processing table ${i + 1}/${totalTables}: ${table.table_name}`)

      const columns = db.prepare(`PRAGMA table_info(${table.table_name})`).all() as any[]

      const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${table.table_name})`).all() as any[]

      const fkMap = new Map()
      foreignKeys.forEach((fk: any) => {
        fkMap.set(fk.from, `${fk.table}.${fk.to}`)
      })

      const processedColumns = columns.map((col: any) => ({
        name: col.name,
        type: col.type,
        nullable: col.notnull === 0,
        primary_key: col.pk === 1,
        foreign_key: fkMap.get(col.name) || undefined,
        description: null,
        aiDescription: null,
      }))

      schema.tables.push({
        name: table.table_name,
        columns: processedColumns,
        description: null,
        aiDescription: null,
      })
    }

    return schema
  } finally {
    db.close()
  }
}
