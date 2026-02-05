import { type NextRequest, NextResponse } from "next/server"
import { validateConnection } from "@/lib/database/connection-validator"
import { sanitizeDbError } from "@/utils/error-sanitizer"
import { getAuthContext } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
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

    // Validate connection and get adapter
    const validationResult = await validateConnection(connection, {
      validateRequiredFields: false, // execute route doesn't require field validation
      authUserId: auth?.userId,
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: validationResult.statusCode }
      )
    }

    const { adapter, config } = validationResult

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
    // Sanitize error to prevent leaking sensitive database information
    const sanitized = sanitizeDbError(error)

    return NextResponse.json(
      { error: sanitized.message, code: sanitized.code },
      { status: sanitized.isUserError ? 400 : 500 }
    )
  }
}
