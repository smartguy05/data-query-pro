import { type NextRequest, NextResponse } from "next/server"
import { DatabaseAdapterFactory, type AdapterConnectionConfig, type DatabaseType } from "@/lib/database"
import { getServerConnectionCredentials } from "@/lib/server-config"

export async function POST(request: NextRequest) {
  try {
    const { sql, connection } = await request.json()

    if (!sql) {
      return NextResponse.json({ error: "SQL query is required" }, { status: 400 })
    }

    const dangerousKeywords = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "TRUNCATE"]
    const upperSQL = sql.toUpperCase()

    for (const keyword of dangerousKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`)
      if (regex.test(upperSQL)) {
        return NextResponse.json(
          {
            error: `Dangerous operation detected: ${keyword}. Only SELECT queries are allowed.`,
          },
          { status: 400 },
        )
      }
    }

    if (!connection) {
      return NextResponse.json({ error: "Database connection information is required" }, { status: 400 })
    }

    // For server connections, look up full connection details from config file
    let connectionDetails = connection
    if (connection.source === "server") {
      const serverConnection = await getServerConnectionCredentials(connection.id)
      if (!serverConnection) {
        return NextResponse.json(
          { error: "Server connection not found" },
          { status: 404 }
        )
      }
      connectionDetails = serverConnection
    }

    // Validate database type
    const dbType = connectionDetails.type as string
    if (!DatabaseAdapterFactory.isSupported(dbType)) {
      return NextResponse.json(
        { error: `Unsupported database type: ${dbType}` },
        { status: 400 }
      )
    }

    // Create adapter for the connection type
    const adapter = DatabaseAdapterFactory.create(dbType as DatabaseType)

    const config: AdapterConnectionConfig = {
      host: connectionDetails.host,
      port: parseInt(connectionDetails.port, 10),
      database: connectionDetails.database,
      username: connectionDetails.username,
      password: connectionDetails.password,
      filepath: connectionDetails.filepath, // For SQLite
      ssl: connectionDetails.host?.includes("azure"),
    }

    try {
      await adapter.connect(config)
      console.log(`[v0] Executing SQL query on ${adapter.displayName}:`, sql)

      const result = await adapter.executeQuery(sql)
      console.log(`[v0] Query executed successfully, returned ${result.rowCount} rows`)

      // Format rows to match existing API contract (convert nulls to "NULL" string)
      const formattedRows = result.rows.map((row) =>
        row.map((value) => (value === null ? "NULL" : String(value)))
      )

      return NextResponse.json({
        columns: result.columns,
        rows: formattedRows,
        rowCount: result.rowCount,
        executionTime: result.executionTime,
      })
    } finally {
      await adapter.disconnect()
    }
  } catch (error) {
    console.error("[v0] Error executing SQL:", error)

    let errorMessage = "Failed to execute query"
    if (error instanceof Error) {
      if (error.message.includes("column") && error.message.includes("does not exist")) {
        errorMessage = `Column not found: ${error.message}`
      } else if (error.message.includes("relation") && error.message.includes("does not exist")) {
        errorMessage = `Table not found: ${error.message}`
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
