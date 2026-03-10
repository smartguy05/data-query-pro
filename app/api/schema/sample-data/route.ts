import { type NextRequest, NextResponse } from "next/server"
import { validateConnection } from "@/lib/database/connection-validator"
import { sanitizeDbError } from "@/utils/error-sanitizer"
import { getAuthContext } from "@/lib/auth/require-auth"

const TABLE_NAME_REGEX = /^[a-zA-Z0-9_\-. ]+$/

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request)
    const body = await request.json()
    const { tableName } = body

    if (!tableName || typeof tableName !== "string") {
      return NextResponse.json({ error: "tableName is required" }, { status: 400 })
    }

    if (!TABLE_NAME_REGEX.test(tableName)) {
      return NextResponse.json({ error: "Invalid table name" }, { status: 400 })
    }

    // Support both { connectionId } (auth mode) and { connection } (no-auth mode)
    const connection = body.connectionId
      ? { id: body.connectionId, source: body.source || "local", type: body.type }
      : body.connection

    const validationResult = await validateConnection(connection, {
      validateRequiredFields: false,
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

      const escapedName = adapter.escapeIdentifier(tableName)
      const sql =
        adapter.type === "sqlserver"
          ? `SELECT TOP 10 * FROM ${escapedName}`
          : `SELECT * FROM ${escapedName} LIMIT 10`

      const result = await adapter.executeQuery(sql)

      const formattedRows = result.rows.map((row) =>
        row.map((value) => (value === null ? "NULL" : String(value)))
      )

      return NextResponse.json({
        columns: result.columns,
        rows: formattedRows,
        rowCount: result.rowCount,
      })
    } finally {
      await adapter.disconnect()
    }
  } catch (error) {
    const sanitized = sanitizeDbError(error)
    return NextResponse.json(
      { error: sanitized.message, code: sanitized.code },
      { status: sanitized.isUserError ? 400 : 500 }
    )
  }
}
