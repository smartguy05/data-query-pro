import { type NextRequest, NextResponse } from "next/server"
import { validateConnection } from "@/lib/database/connection-validator"
import { validateReadOnlySql } from "@/lib/database/sql-validator"
import { applyDefaultRowLimit, sanitizeLimit } from "@/lib/database/sql-limit"
import { sanitizeDbError } from "@/utils/error-sanitizer"
import { getAuthContext } from '@/lib/auth/require-auth';
import { CANCELLED_LOG_MESSAGE, logQuery } from "@/lib/query-log"
import { supportsDirtyRead } from "@/lib/database/types"
import {
  parseQueryId,
  registerQuery,
  registryKey,
  unregisterQuery,
} from "@/lib/database/query-registry"

/**
 * Stable, machine-readable discriminators on this route's error responses.
 * Additive alongside the existing `error` / `code` / `detail` fields: a 400 can
 * mean either "the AST validator rejected this SQL" or "the database rejected
 * this SQL" (hallucinated column, syntax error), and those are different
 * failures for anything analyzing the responses (see evals/lib/classify.ts).
 */
const EXECUTE_ERROR_CODES = {
  sqlRequired: "SQL_REQUIRED",
  connectionInvalid: "CONNECTION_INVALID",
  sqlValidationRejected: "SQL_VALIDATION_REJECTED",
  dbUserError: "DB_USER_ERROR",
  dbError: "DB_ERROR",
  invalidQueryId: "INVALID_QUERY_ID",
  cancelled: "QUERY_CANCELLED",
} as const

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = await request.json()
    const sql = body.sql;
    // Active namespace the query targets (PostgreSQL/SQL Server). Threaded into
    // the adapter config so PostgreSQL sets search_path to this schema.
    const schema = body.schema ?? body.connection?.activeSchema;
    // Support both { connectionId } (auth mode) and { connection } (no-auth mode)
    const connection = body.connectionId
      ? { id: body.connectionId, source: body.source || 'local', type: body.type, schema }
      : { ...body.connection, schema };

    if (!sql) {
      return NextResponse.json(
        { error: "SQL query is required", errorCode: EXECUTE_ERROR_CODES.sqlRequired },
        { status: 400 }
      )
    }

    // Validate connection and get adapter (dbType is needed to pick the SQL dialect)
    const validationResult = await validateConnection(connection, {
      validateRequiredFields: false, // execute route doesn't require field validation
      authUserId: auth?.userId,
    })

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error, errorCode: EXECUTE_ERROR_CODES.connectionInvalid },
        { status: validationResult.statusCode }
      )
    }

    const { adapter, config, dbType } = validationResult

    // AST-based validation: allow exactly one read-only SELECT statement.
    // Fails closed (rejects on parse error) — see lib/database/sql-validator.ts.
    const sqlCheck = validateReadOnlySql(sql, dbType)
    if (!sqlCheck.valid) {
      return NextResponse.json(
        { error: sqlCheck.error, errorCode: EXECUTE_ERROR_CODES.sqlValidationRejected },
        { status: 400 }
      )
    }

    // Inject the user's default row limit when the SQL has none — an explicit
    // LIMIT/TOP/FETCH in the SQL always wins (see lib/database/sql-limit.ts).
    const requestedLimit = sanitizeLimit(body.defaultLimit)
    let effectiveSql: string = sql
    let limitApplied: number | undefined
    if (requestedLimit !== null) {
      const limitResult = applyDefaultRowLimit(sql, dbType, requestedLimit)
      effectiveSql = limitResult.sql
      if (limitResult.applied) limitApplied = requestedLimit
    }

    // Defense-in-depth: run the query in a read-only context so even a statement
    // that slips past the validator cannot mutate data.
    config.readOnly = true

    // Optional dirty reads (READ UNCOMMITTED), a per-user preference defaulting
    // to off. Strict === true because the body is untrusted: it collapses
    // "false" / 1 / {} to false. Composes with readOnly above rather than
    // replacing it — see AdapterConnectionConfig.dirtyRead.
    const dirtyRead = body.dirtyRead === true
    config.dirtyRead = dirtyRead
    // Reported back honestly: true = the isolation level was lowered, false =
    // requested but this engine has no dirty-read mode (PostgreSQL/SQLite).
    const dirtyReadApplied = dirtyRead ? supportsDirtyRead(dbType) : undefined

    // Common, credentials-free fields for the audit log (see lib/query-log.ts).
    const logBase = {
      userId: auth?.userId ?? null,
      connectionId: connection?.id ?? "unknown",
      connectionName: typeof connection?.name === "string" ? connection.name : undefined,
      databaseType: dbType,
      question: typeof body.question === "string" ? body.question : undefined,
      sql: effectiveSql,
      source: typeof body.querySource === "string" ? body.querySource : undefined,
    }

    // Cancellation wiring. The id is generated client-side (it is needed before
    // this response exists) and validated here; an ABSENT id is fine and simply
    // runs the query untracked, which keeps older clients and the eval harness
    // working. A malformed one is a 400.
    const rawQueryId = body.queryId
    const queryId = parseQueryId(rawQueryId)
    if (rawQueryId !== undefined && queryId === undefined) {
      return NextResponse.json(
        { error: "Invalid queryId", errorCode: EXECUTE_ERROR_CODES.invalidQueryId },
        { status: 400 }
      )
    }

    // With auth disabled there is no user identity to scope by, and inventing one
    // (e.g. a localStorage token) would be trivially spoofable security theatre —
    // this app already accepts client-supplied credentials by design in that mode.
    // Keeping the namespace means enabling auth grants real isolation for free.
    const ownerKey = auth ? `user:${auth.userId}` : "anon"
    const controller = new AbortController()
    // Client disconnect (tab closed, navigation) also kills the database query.
    request.signal.addEventListener("abort", () => controller.abort(), { once: true })

    let registeredKey: string | undefined
    if (queryId) {
      const key = registryKey(ownerKey, queryId)
      // Registered BEFORE connect(): connect can itself block for seconds, and a
      // cancel arriving during it must still be honored.
      if (
        registerQuery(key, {
          controller,
          ownerKey,
          engine: dbType,
          cancellable: adapter.supportsCancellation,
          startedAt: Date.now(),
        })
      ) {
        registeredKey = key
      }
    }

    /** Cancellation is classified from our own signal, never from the driver's
     * message: none of PostgreSQL's "canceling statement due to user request",
     * MySQL's "Query execution was interrupted" or mssql's "Canceled." match any
     * pattern in sanitizeDbError, so they would all become a generic 500. */
    const cancelledResponse = () => {
      logQuery({ ...logBase, success: false, error: CANCELLED_LOG_MESSAGE })
      return NextResponse.json(
        {
          error: "Query cancelled",
          errorCode: EXECUTE_ERROR_CODES.cancelled,
          cancelled: true,
        },
        { status: 499 }
      )
    }

    try {
      await adapter.connect(config)
      // A cancel that landed while connecting must not start the query.
      if (controller.signal.aborted) return cancelledResponse()
      console.log(`[v0] Executing SQL query on ${adapter.displayName}:`, effectiveSql)

      const result = await adapter.executeQuery(effectiveSql, { signal: controller.signal })
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
        // Present only when a default row limit was injected into the SQL.
        limitApplied,
        // Present only when dirty reads were requested; false = this engine has
        // no dirty-read mode, so the request was a no-op.
        dirtyReadApplied,
      })
    } catch (execError) {
      // RETURN, don't throw: the outer handler would run this through
      // sanitizeDbError and turn a cancellation into a 500 "Failed to execute
      // database operation" plus a spurious stack trace in the logs.
      if (controller.signal.aborted) return cancelledResponse()

      // Log the execution failure (sanitized) before re-throwing to the outer handler.
      logQuery({
        ...logBase,
        success: false,
        error: sanitizeDbError(execError).message,
      })
      throw execError
    } finally {
      // Guarded: disconnect is much more likely to throw after a cancelled or
      // rolled-back transaction, and an unguarded throw here would replace the
      // response we just built.
      try {
        await adapter.disconnect()
      } catch (err) {
        console.warn("[execute] disconnect failed:", err)
      }
      // Every exit path passes through here, so the registry cannot leak.
      if (registeredKey) unregisterQuery(registeredKey)
    }
  } catch (error) {
    // Sanitize error to prevent leaking sensitive database information
    const sanitized = sanitizeDbError(error)

    return NextResponse.json(
      {
        error: sanitized.message,
        code: sanitized.code,
        detail: sanitized.detail,
        errorCode: sanitized.isUserError
          ? EXECUTE_ERROR_CODES.dbUserError
          : EXECUTE_ERROR_CODES.dbError,
      },
      { status: sanitized.isUserError ? 400 : 500 }
    )
  }
}
