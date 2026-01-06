import { NextResponse } from "next/server";
import { getServerConfig, stripSensitiveData } from "@/lib/server-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/config/connections
 *
 * Reads database configuration from a server-side config file.
 * This allows administrators to deploy pre-configured database connections,
 * schemas, and reports that will be shared across all users.
 *
 * SECURITY: Passwords are stripped from server connections before sending to client.
 * APIs that need credentials will look them up server-side by connection ID.
 *
 * Config file location: /config/databases.json in the project root
 */
export async function GET() {
  try {
    const config = await getServerConfig();

    if (!config) {
      return NextResponse.json({
        success: true,
        connections: [],
      });
    }

    // Mark all connections as coming from server, strip passwords, and ensure disconnected initially
    const serverConnections = config.connections.map((conn: DatabaseConnection) => {
      const safeConnection = stripSensitiveData(conn);
      return {
        ...safeConnection,
        source: "server" as const,
        status: "disconnected" as const,
      };
    });

    // Extract current connection if present, also strip password
    let currentConnection = null;
    if (config.currentDbConnection) {
      const safeCurrentConnection = stripSensitiveData(config.currentDbConnection);
      currentConnection = {
        ...safeCurrentConnection,
        source: "server" as const,
      };
    }

    return NextResponse.json({
      success: true,
      connections: serverConnections,
      schemaData: config.schemaData || null,
      savedReports: config.savedReports || null,
      currentConnection,
    });
  } catch (error) {
    console.error("Error reading server config:", error);
    return NextResponse.json(
      {
        error: "Failed to read server configuration",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
