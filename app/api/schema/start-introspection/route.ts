import { type NextRequest, NextResponse } from "next/server"
import { introspectSchema } from "@/utils/schema-introspection-adapters"

declare global {
  var processStatus: Map<
    string,
    {
      status: "pending" | "processing" | "completed" | "error"
      progress: number
      message: string
      result?: any
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
    const { connection } = await request.json()

    if (!connection) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
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

async function processSchemaInBackground(processId: string, connection: any) {
  try {
    global.processStatus.set(processId, {
      ...global.processStatus.get(processId)!,
      status: "processing",
      progress: 10,
      message: `Connecting to ${connection.type} database...`,
    })

    const updateProgress = (progress: number, message: string) => {
      global.processStatus.set(processId, {
        ...global.processStatus.get(processId)!,
        progress,
        message,
      })
    }

    const schema = await introspectSchema(connection, updateProgress)

    global.processStatus.set(processId, {
      ...global.processStatus.get(processId)!,
      status: "completed",
      progress: 100,
      message: `Schema introspection completed! Found ${schema.tables.length} tables.`,
      result: { schema },
    })
  } catch (error) {
    console.error("Background schema processing error:", error)
    global.processStatus.set(processId, {
      ...global.processStatus.get(processId)!,
      status: "error",
      progress: 0,
      message: "Schema introspection failed",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
