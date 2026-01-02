import { type NextRequest, NextResponse } from "next/server"
import { DatabaseAdapterFactory, type AdapterConnectionConfig, type DatabaseType } from "@/lib/database"

export async function POST(request: NextRequest) {
  try {
    const { connection } = await request.json()

    if (!connection) {
      return NextResponse.json({ error: "Connection data is required" }, { status: 400 })
    }

    // Validate database type
    const dbType = connection.type as string
    if (!DatabaseAdapterFactory.isSupported(dbType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported database type: ${dbType}`,
        },
        { status: 400 }
      )
    }

    // For SQLite, filepath is required
    if (dbType === "sqlite" && !connection.filepath) {
      return NextResponse.json(
        {
          success: false,
          error: "SQLite requires a file path",
        },
        { status: 400 }
      )
    }

    // For other databases, validate required fields
    if (dbType !== "sqlite") {
      if (!connection.host || !connection.database || !connection.username) {
        return NextResponse.json(
          {
            success: false,
            error: "Host, database, and username are required",
          },
          { status: 400 }
        )
      }
    }

    const adapter = DatabaseAdapterFactory.create(dbType as DatabaseType)

    const config: AdapterConnectionConfig = {
      host: connection.host || "",
      port: parseInt(connection.port || "0", 10),
      database: connection.database || "",
      username: connection.username || "",
      password: connection.password || "",
      filepath: connection.filepath,
      ssl: connection.host?.includes("azure"),
    }

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
    console.error("[v0] Connection test error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Connection test failed",
      },
      { status: 500 }
    )
  }
}
