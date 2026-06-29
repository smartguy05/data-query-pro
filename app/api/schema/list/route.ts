import { type NextRequest, NextResponse } from "next/server"
import { validateConnection } from "@/lib/database/connection-validator"
import { defaultSchemaForType } from "@/lib/database"
import { sanitizeDbError } from "@/utils/error-sanitizer"
import { getAuthContext } from "@/lib/auth/require-auth"

/**
 * Lists the database namespaces ("schemas") available on a connection, so the UI
 * can offer a schema switcher. Returns `{ schemas: string[], defaultSchema }`.
 * Databases without a namespace concept (MySQL/SQLite) return an empty list.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request)
    const body = await request.json()

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

    const { adapter, config, dbType } = validationResult

    try {
      await adapter.connect(config)
      const schemas = await adapter.listSchemas()
      return NextResponse.json({
        schemas,
        defaultSchema: defaultSchemaForType(dbType),
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
