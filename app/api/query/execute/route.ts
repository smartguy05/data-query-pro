import { type NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/utils/database-adapters"

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

    try {
      console.log(`[${connection.type}] Executing SQL query:`, sql)
      const result = await executeQuery(connection, sql)

      const executionTime = Date.now() - startTime

      console.log(`[${connection.type}] Query executed successfully, returned`, result.rowCount, "rows")

      return NextResponse.json({
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        executionTime,
      })
    } catch (queryError) {
      throw queryError
    }
  } catch (error) {
    console.error("[Query Execution] Error executing SQL:", error)

    let errorMessage = "Failed to execute query"
    if (error instanceof Error) {
      if (error.message.includes("column") && error.message.includes("does not exist")) {
        errorMessage = `Column not found: ${error.message}`
      } else if (error.message.includes("relation") && error.message.includes("does not exist")) {
        errorMessage = `Table not found: ${error.message}`
      } else if (error.message.includes("table") && error.message.includes("doesn't exist")) {
        errorMessage = `Table not found: ${error.message}`
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
