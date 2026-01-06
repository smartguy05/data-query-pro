import { type NextRequest, NextResponse } from "next/server"
import { validateConnection } from "@/lib/database/connection-validator"
import { sanitizeDbError } from "@/utils/error-sanitizer"

export async function POST(request: NextRequest) {
  try {
    const { connection } = await request.json()

    // Validate connection and get adapter
    const validationResult = await validateConnection(connection)

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error },
        { status: validationResult.statusCode }
      )
    }

    const { adapter, config } = validationResult

    console.log(`[v0] Testing ${adapter.displayName} connection:`, {
      host: config.host,
      database: config.database,
      filepath: config.filepath,
    })

    const result = await adapter.testConnection(config)

    if (result.success) {
      console.log(`[v0] Connection test successful (${result.latencyMs}ms)`)
      return NextResponse.json({
        success: true,
        message: result.message,
        latencyMs: result.latencyMs,
        serverVersion: result.serverVersion,
      })
    } else {
      console.log(`[v0] Connection test failed: ${result.message}`)
      return NextResponse.json(
        {
          success: false,
          error: result.message,
        },
        { status: 400 }
      )
    }
  } catch (error) {
    // Sanitize error to prevent leaking sensitive connection information
    const sanitized = sanitizeDbError(error)

    return NextResponse.json(
      {
        success: false,
        error: sanitized.message,
        code: sanitized.code,
      },
      { status: sanitized.isUserError ? 400 : 500 }
    )
  }
}
