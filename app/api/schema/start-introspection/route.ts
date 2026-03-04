import { type NextRequest, NextResponse } from "next/server"
import { DatabaseAdapterFactory, type AdapterConnectionConfig, type DatabaseType } from "@/lib/database"
import { validateConnection } from "@/lib/database/connection-validator"
import { getAuthContext } from '@/lib/auth/require-auth'

declare global {
  var processStatus: Map<
    string,
    {
      status: "pending" | "processing" | "completed" | "error"
      progress: number
      message: string
      result?: unknown
      error?: string
      startTime: number
    }
  >
}

// Initialize global storage if it doesn't exist
if (!global.processStatus) {
  global.processStatus = new Map()
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = await request.json()

    // Support both { connectionId } (auth mode) and { connection } (no-auth mode)
    const connection = body.connectionId
      ? { id: body.connectionId, source: body.source || 'local', type: body.type }
      : body.connection;

    if (!connection) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    // Resolve credentials and validate via the shared connection validator
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

    const { config, dbType } = validationResult

    // Generate unique process ID
    const processId = `schema_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    global.processStatus.set(processId, {
      status: "pending",
      progress: 0,
      message: "Starting schema introspection...",
      startTime: Date.now(),
    })

    // Start background processing with resolved config (don't await)
    processSchemaInBackground(processId, dbType, config)

    return NextResponse.json({
      processId,
      message: "Schema introspection started in background",
    })
  } catch (error) {
    console.error("Error starting schema introspection:", error)
    return NextResponse.json({ error: "Failed to start schema introspection" }, { status: 500 })
  }
}

async function processSchemaInBackground(
  processId: string,
  dbType: DatabaseType,
  config: AdapterConnectionConfig
) {
  let adapter = null

  try {
    global.processStatus.set(processId, {
      ...global.processStatus.get(processId)!,
      status: "processing",
      progress: 10,
      message: "Connecting to database...",
    })

    adapter = DatabaseAdapterFactory.create(dbType)
    await adapter.connect(config)

    global.processStatus.set(processId, {
      ...global.processStatus.get(processId)!,
      progress: 25,
      message: "Fetching table information...",
    })

    // Use adapter's introspectSchema with progress callback
    const result = await adapter.introspectSchema((progress, message) => {
      // Scale progress from adapter's 10-100 to our 25-85 range
      const scaledProgress = 25 + Math.floor(((progress - 10) / 90) * 60)
      global.processStatus.set(processId, {
        ...global.processStatus.get(processId)!,
        progress: Math.min(scaledProgress, 85),
        message,
      })
    })

    await adapter.disconnect()
    adapter = null

    // Add default AI descriptions
    const schema = {
      tables: result.tables.map((table) => ({
        ...table,
        aiDescription: table.aiDescription || null,
        description: table.description || null,
        columns: table.columns.map((col) => ({
          ...col,
          aiDescription: col.aiDescription || null,
          description: col.description || null,
        })),
      })),
    }

    global.processStatus.set(processId, {
      ...global.processStatus.get(processId)!,
      status: "completed",
      progress: 100,
      message: `Schema introspection completed! Found ${schema.tables.length} tables.`,
      result: { schema },
    })
  } catch (error) {
    console.error("Background schema processing error:", error)

    // Ensure adapter is disconnected on error
    if (adapter) {
      try {
        await adapter.disconnect()
      } catch {
        // Ignore disconnect errors
      }
    }

    global.processStatus.set(processId, {
      ...global.processStatus.get(processId)!,
      status: "error",
      progress: 0,
      message: "Schema introspection failed",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
