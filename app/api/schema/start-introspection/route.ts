import { type NextRequest, NextResponse } from "next/server"
import type { Column } from "@/models/column.interface"
import { DatabaseAdapterFactory, type AdapterConnectionConfig, type DatabaseType } from "@/lib/database"
import { validateConnection } from "@/lib/database/connection-validator"
import { getAuthContext } from '@/lib/auth/require-auth'
// Job state and the per-job AbortController live in one shared module (they used
// to be a `declare global` block duplicated here and in status/route.ts).
import {
  clearIntrospectionController,
  patchJob,
  registerIntrospectionController,
  setJob,
} from "@/lib/schema/introspection-jobs"

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = await request.json()

    // Namespace to introspect (PostgreSQL/SQL Server); undefined ⇒ adapter default.
    const schema = body.schema ?? body.connection?.activeSchema;
    // Support both { connectionId } (auth mode) and { connection } (no-auth mode)
    const connection = body.connectionId
      ? { id: body.connectionId, source: body.source || 'local', type: body.type, schema }
      : { ...body.connection, schema };

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

    setJob(processId, {
      status: "pending",
      progress: 0,
      message: "Starting schema introspection...",
      startTime: Date.now(),
    })

    // Registered before the work starts so a cancel arriving immediately still
    // finds something to abort.
    const controller = new AbortController()
    registerIntrospectionController(processId, controller)

    // Start background processing with resolved config (don't await)
    processSchemaInBackground(processId, dbType, config, controller)

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
  config: AdapterConnectionConfig,
  controller: AbortController
) {
  let adapter = null

  try {
    patchJob(processId, {
      status: "processing",
      progress: 10,
      message: "Connecting to database...",
    })

    adapter = DatabaseAdapterFactory.create(dbType)
    await adapter.connect(config)

    patchJob(processId, {
      progress: 25,
      message: "Fetching table information...",
    })

    // Use adapter's introspectSchema with progress callback. The signal cancels
    // cooperatively between tables — see BaseDatabaseAdapter.introspectSchema.
    const result = await adapter.introspectSchema(
      (progress, message) => {
        // Scale progress from adapter's 10-100 to our 25-85 range
        const scaledProgress = 25 + Math.floor(((progress - 10) / 90) * 60)
        patchJob(processId, {
          progress: Math.min(scaledProgress, 85),
          message,
        })
      },
      { signal: controller.signal }
    )

    await adapter.disconnect()
    adapter = null

    // Add default AI descriptions
    const schema = {
      tables: result.tables.map((table) => ({
        ...table,
        aiDescription: table.aiDescription || null,
        description: table.description || null,
        columns: table.columns.map((col: Column) => ({
          ...col,
          aiDescription: col.aiDescription || null,
          description: col.description || null,
        })),
      })),
    }

    patchJob(processId, {
      status: "completed",
      progress: 100,
      message: `Schema introspection completed! Found ${schema.tables.length} tables.`,
      result: { schema },
    })
  } catch (error) {
    // Ensure adapter is disconnected on error
    if (adapter) {
      try {
        await adapter.disconnect()
      } catch {
        // Ignore disconnect errors
      }
    }

    // A cancellation is not a failure: cancelIntrospection() has already set the
    // 'cancelled' status, so don't overwrite it with an error the user would have
    // to dismiss. Classified from our own signal, not the thrown message.
    if (controller.signal.aborted) {
      return
    }

    console.error("Background schema processing error:", error)
    patchJob(processId, {
      status: "error",
      progress: 0,
      message: "Schema introspection failed",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  } finally {
    // The job is terminal now; drop the controller so a late cancel cannot fire.
    clearIntrospectionController(processId)
  }
}
