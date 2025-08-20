import { type NextRequest, NextResponse } from "next/server"
import postgres from "postgres"

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

    const startTime = Date.now()

    const pgClient = postgres({
      host: connection.host,
      port: Number.parseInt(connection.port),
      database: connection.database,
      username: connection.username,
      password: connection.password,
      ssl: connection.host.includes("azure") ? { rejectUnauthorized: false } : false,
    })

    try {
      console.log("[v0] Executing SQL query:", sql)
      const result = await pgClient.unsafe(sql)

      const executionTime = Date.now() - startTime

      const columns = result.length > 0 ? Object.keys(result[0]) : []
      const rows = result.map((row) =>
        columns.map((col) => {
          const value = row[col]
          if (value === null) return "NULL"
          if (value instanceof Date) return value.toISOString().split("T")[0]
          if (typeof value === "number") return value.toString()
          return String(value)
        }),
      )

      console.log("[v0] Query executed successfully, returned", result.length, "rows")

      return NextResponse.json({
        columns,
        rows,
        rowCount: result.length,
        executionTime,
      })
    } finally {
      await pgClient.end()
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
