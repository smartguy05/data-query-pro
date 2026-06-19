import { type NextRequest, NextResponse } from "next/server"
import { validateConnection } from "@/lib/database/connection-validator"
import { validateReadOnlySql } from "@/lib/database/sql-validator"
import { sanitizeDbError } from "@/utils/error-sanitizer"
import { getAuthContext } from '@/lib/auth/require-auth';
import { logQuery } from "@/lib/query-log"

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = await request.json()
    const sql = body.sql;
    // Support both { connectionId } (auth mode) and { connection } (no-auth mode)
    const connection = body.connectionId
      ? { id: body.connectionId, source: body.source || 'local', type: body.type }
      : body.connection;

    if (!sql) {
      return NextResponse.json({ error: "SQL query is required" }, { status: 400 })
    }

    // Validate connection and get adapter (dbType is needed to pick the SQL dialect)
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

    const { adapter, config, dbType } = validationResult

    // AST-based validation: allow exactly one read-only SELECT statement.
    // Fails closed (rejects on parse error) — see lib/database/sql-validator.ts.
    const sqlCheck = validateReadOnlySql(sql, dbType)
    if (!sqlCheck.valid) {
      return NextResponse.json({ error: sqlCheck.error }, { status: 400 })
    }

    // Defense-in-depth: run the query in a read-only context so even a statement
    // that slips past the validator cannot mutate data.
    config.readOnly = true

    // Common, credentials-free fields for the audit log (see lib/query-log.ts).
    const logBase = {
      userId: auth?.userId ?? null,
      connectionId: connection?.id ?? "unknown",
      connectionName: typeof connection?.name === "string" ? connection.name : undefined,
      databaseType: dbType,
      question: typeof body.question === "string" ? body.question : undefined,
      sql,
      source: typeof body.querySource === "string" ? body.querySource : undefined,
    }

    try {
      await adapter.connect(config)
      console.log(`[v0] Executing SQL query on ${adapter.displayName}:`, sql)

      const result = await adapter.executeQuery(sql)
      console.log(`[v0] Query executed successfully, returned ${result.rowCount} rows`)

      logQuery({
        ...logBase,
        success: true,
        rowCount: result.rowCount,
        durationMs: result.executionTime,
      })

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
    } catch (execError) {
      // Log the execution failure (sanitized) before re-throwing to the outer handler.
      logQuery({
        ...logBase,
        success: false,
        error: sanitizeDbError(execError).message,
      })
      throw execError
    } finally {
      await adapter.disconnect()
    }
  } catch (error) {
    // Sanitize error to prevent leaking sensitive database information
    const sanitized = sanitizeDbError(error)

    return NextResponse.json(
      { error: sanitized.message, code: sanitized.code, detail: sanitized.detail },
      { status: sanitized.isUserError ? 400 : 500 }
    )
  }
}
