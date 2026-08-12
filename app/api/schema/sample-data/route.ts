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

    // Sample data must come from the active namespace (PostgreSQL/SQL Server).
    const schema = body.schema ?? body.connection?.activeSchema
    // Support both { connectionId } (auth mode) and { connection } (no-auth mode)
    const connection = body.connectionId
      ? { id: body.connectionId, source: body.source || "local", type: body.type, schema }
      : { ...body.connection, schema }

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

    // Sample-data only ever runs a generated SELECT — enforce read-only too.
    config.readOnly = true

    // Honor the user's dirty-read preference here as well. This is the endpoint
    // most likely to block: the SQL below is an unrestricted scan of a table that
    // may be under active write load, with no user-visible query text to blame it
    // on. Strict === true because the body is untrusted.
    config.dirtyRead = body.dirtyRead === true

    try {
      await adapter.connect(config)

      const escapedName = adapter.escapeIdentifier(tableName)
      const sql =
        adapter.type === "sqlserver"
          ? `SELECT TOP 10 * FROM ${escapedName}`
          : `SELECT * FROM ${escapedName} LIMIT 10`

      // Abandoning the preview (collapsing the row, unmounting, switching
      // connection) aborts the fetch, which cancels the scan on the database
      // rather than leaving it to finish unwatched.
      const result = await adapter.executeQuery(sql, { signal: request.signal })

      const formattedRows = result.rows.map((row) =>
        row.map((value) => (value === null ? "NULL" : String(value)))
      )

      return NextResponse.json({
        columns: result.columns,
        rows: formattedRows,
        rowCount: result.rowCount,
      })
    } finally {
      // Guarded: an unguarded throw here would replace the response or the real
      // error with a disconnect failure.
      try {
        await adapter.disconnect()
      } catch (err) {
        console.warn("[sample-data] disconnect failed:", err)
      }
    }
  } catch (error) {
    const sanitized = sanitizeDbError(error)
    return NextResponse.json(
      { error: sanitized.message, code: sanitized.code },
      { status: sanitized.isUserError ? 400 : 500 }
    )
  }
}
