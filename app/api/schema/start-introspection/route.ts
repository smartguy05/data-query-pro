import { type NextRequest, NextResponse } from "next/server"
import { DatabaseAdapterFactory, type AdapterConnectionConfig, type DatabaseType } from "@/lib/database"
import { getServerConnectionCredentials } from "@/lib/server-config"
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
    const { connection } = await request.json()

    if (!connection) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    // Validate database type
    const dbType = connection.type as string
    if (!DatabaseAdapterFactory.isSupported(dbType)) {
      return NextResponse.json(
        { error: `Unsupported database type: ${dbType}` },
        { status: 400 }
      )
    }

    // Generate unique process ID
    const processId = `schema_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    global.processStatus.set(processId, {
      status: "pending",
      progress: 0,
      message: "Starting schema introspection...",
      startTime: Date.now(),
    })

    // Start background processing (don't await)
    processSchemaInBackground(processId, connection)

    return NextResponse.json({
      processId,
      message: "Schema introspection started in background",
    })
  } catch (error) {
    console.error("Error starting schema introspection:", error)
    return NextResponse.json({ error: "Failed to start schema introspection" }, { status: 500 })
  }
}

async function processSchemaInBackground(processId: string, connection: Record<string, unknown>) {
  let adapter = null

  try {
    global.processStatus.set(processId, {
      ...global.processStatus.get(processId)!,
      status: "processing",
      progress: 10,
      message: "Connecting to database...",
    })

    // For server connections, look up full connection details from config file
    let connectionDetails = connection
    if (connection.source === "server") {
      const serverConnection = await getServerConnectionCredentials(connection.id as string)
      if (!serverConnection) {
        throw new Error("Server connection not found")
      }
      connectionDetails = serverConnection
    }

    const dbType = connectionDetails.type as DatabaseType
    adapter = DatabaseAdapterFactory.create(dbType)

    const config: AdapterConnectionConfig = {
      host: connectionDetails.host as string,
      port: parseInt(connectionDetails.port as string, 10),
      database: connectionDetails.database as string,
      username: connectionDetails.username as string,
      password: connectionDetails.password as string,
      filepath: connectionDetails.filepath as string | undefined,
      ssl: (connectionDetails.host as string)?.includes("azure"),
    }

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
