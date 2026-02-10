import { type NextRequest, NextResponse } from "next/server"
import { validateConnection } from "@/lib/database/connection-validator"
import { sanitizeDbError } from "@/utils/error-sanitizer"
import { getAuthContext } from '@/lib/auth/require-auth'

export async function GET() {
  try {
    // Simulate schema introspection delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // In a real implementation, this would:
    // 1. Connect to the database using stored credentials
    // 2. Query information_schema or equivalent
    // 3. Extract table and column metadata
    // 4. Return the actual schema structure

    return NextResponse.json({
      success: true,
      schema: { tables: [] },
    })
  } catch (error) {
    console.error("Schema introspection error:", error)
    return NextResponse.json({ error: "Failed to introspect schema" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = await request.json()
    // Support both { connectionId } (auth mode) and { connection } (no-auth mode)
    const connection = body.connectionId
      ? { id: body.connectionId, source: body.source || 'local', type: body.type }
      : body.connection;

    console.log("[v0] Connecting to database:", {
      type: connection?.type,
      id: connection?.id,
      source: connection?.source,
    })

    // Validate connection and get adapter
    const validationResult = await validateConnection(connection, {
      validateRequiredFields: false, // introspect doesn't require field validation
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
      console.log("[v0] Connected to database successfully")

      const result = await adapter.introspectSchema()

      // Add default AI descriptions
      const schema = {
        tables: result.tables.map((table) => ({
          ...table,
          aiDescription: table.aiDescription || `Table containing ${table.name} data`,
          columns: table.columns.map((col) => ({
            ...col,
            aiDescription: col.aiDescription || `${col.name} field of type ${col.type}`,
          })),
        })),
      }

      console.log("[v0] Schema introspection completed:", schema.tables.length, "tables found")

      return NextResponse.json({
        success: true,
        schema: schema,
      })
    } finally {
      await adapter.disconnect()
    }
  } catch (error) {
    console.error("[v0] Schema introspection error:", error)
    // Sanitize error to prevent leaking sensitive database information
    const sanitized = sanitizeDbError(error)

    return NextResponse.json(
      {
        error: sanitized.message,
        code: sanitized.code,
      },
      { status: sanitized.isUserError ? 400 : 500 }
    )
  }
}
