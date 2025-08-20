import { type NextRequest, NextResponse } from "next/server"
import postgres from "postgres"

declare global {
  var processStatus: Map<
    string,
    {
      status: "pending" | "processing" | "completed" | "error"
      progress: number
      message: string
      result?: any
      error?: string
      startTime: number
    }
  >
}

// Initialize global storage if it doesn't exist
if (!global.processStatus) {
  global.processStatus = new Map()
}

export async function POST(request: NextRequest) {
  try {
    const { connection } = await request.json()

    if (!connection) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    // Generate unique process ID
    const processId = `schema_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    global.processStatus.set(processId, {
      status: "pending",
      progress: 0,
      message: "Starting schema introspection...",
      startTime: Date.now(),
    })

    // Start background processing (don't await)
    processSchemaInBackground(processId, connection)

    return NextResponse.json({
      processId,
      message: "Schema introspection started in background",
    })
  } catch (error) {
    console.error("Error starting schema introspection:", error)
    return NextResponse.json({ error: "Failed to start schema introspection" }, { status: 500 })
  }
}

async function processSchemaInBackground(processId: string, connection: any) {
  try {
    global.processStatus.set(processId, {
      ...global.processStatus.get(processId)!,
      status: "processing",
      progress: 10,
      message: "Connecting to database...",
    })

    const sql = postgres({
      host: connection.host,
      port: Number.parseInt(connection.port),
      database: connection.database,
      username: connection.username,
      password: connection.password,
      ssl: connection.host.includes("azure") ? { rejectUnauthorized: false } : false,
    })

    global.processStatus.set(processId, {
      ...global.processStatus.get(processId)!,
      progress: 25,
      message: "Fetching table information...",
    })

    // Get all tables using PostgreSQL system catalogs
    const tables = await sql`
      SELECT 
        t.tablename as table_name
      FROM pg_catalog.pg_tables t
      WHERE t.schemaname = 'public'
      ORDER BY t.tablename
    `

    const totalTables = tables.length
    const schema = { tables: [] as any[] }

    // Process each table
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i]
      const progress = 25 + Math.floor((i / totalTables) * 60) // 25% to 85%

      global.processStatus.set(processId, {
        ...global.processStatus.get(processId)!,
        progress,
        message: `Processing table ${i + 1}/${totalTables}: ${table.table_name}`,
      })

      const columns = await sql`
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
        WHERE c.relname = ${table.table_name}
        AND n.nspname = 'public'
        AND a.attnum > 0
        AND NOT a.attisdropped
        ORDER BY a.attnum
      `

      const foreignKeys = await sql`
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

      // Create foreign key lookup map
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

    await sql.end()

    global.processStatus.set(processId, {
      ...global.processStatus.get(processId)!,
      status: "completed",
      progress: 100,
      message: `Schema introspection completed! Found ${totalTables} tables.`,
      result: { schema },
    })
  } catch (error) {
    console.error("Background schema processing error:", error)
    global.processStatus.set(processId, {
      ...global.processStatus.get(processId)!,
      status: "error",
      progress: 0,
      message: "Schema introspection failed",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
