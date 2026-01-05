import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/config/connections
 *
 * Reads database configuration from a server-side config file.
 * This allows administrators to deploy pre-configured database connections,
 * schemas, and reports that will be shared across all users.
 *
 * Config file location: /config/databases.json in the project root
 *
 * Supports multiple formats:
 * 1. Simple connections array: { "connections": [...] }
 * 2. Full app export: { "databaseConnections": [...], "schemaData": {...}, "savedReports": [...] }
 * 3. Direct array: [...]
 */
export async function GET() {
  try {
    // Look for config file in the project root
    const configPath = join(process.cwd(), "config", "databases.json");

    try {
      const fileContent = await readFile(configPath, "utf-8");
      const config = JSON.parse(fileContent);

      // Support multiple formats:
      // 1. Object with connections array: { "connections": [...] }
      // 2. Object with databaseConnections array (from export): { "databaseConnections": [...] }
      // 3. Direct array: [...]
      let connections: DatabaseConnection[];

      if (Array.isArray(config)) {
        // Direct array format
        connections = config;
      } else if (config.connections && Array.isArray(config.connections)) {
        // Object with connections property
        connections = config.connections;
      } else if (config.databaseConnections && Array.isArray(config.databaseConnections)) {
        // Object with databaseConnections property (from app export)
        connections = config.databaseConnections;
      } else {
        return NextResponse.json(
          { error: "Invalid config file structure. Expected 'connections' or 'databaseConnections' array." },
          { status: 400 }
        );
      }

      // Mark all connections as coming from server and ensure they're disconnected initially
      const serverConnections = connections.map((conn: DatabaseConnection) => ({
        ...conn,
        source: "server" as const,
        status: "disconnected" as const,
      }));

      // Extract schema data if present (from full app export)
      let schemaData = null;
      if (config.schemaData) {
        schemaData = config.schemaData;
      }

      // Extract saved reports if present (from full app export)
      let savedReports = null;
      if (config.savedReports && Array.isArray(config.savedReports)) {
        savedReports = config.savedReports;
      }

      // Extract current connection if present (from full app export)
      let currentConnection = null;
      if (config.currentDbConnection) {
        currentConnection = {
          ...config.currentDbConnection,
          source: "server" as const,
        };
      }

      return NextResponse.json({
        success: true,
        connections: serverConnections,
        schemaData,
        savedReports,
        currentConnection,
      });
    } catch (fileError) {
      // File doesn't exist or can't be read - this is not an error, just means no server config
      if ((fileError as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json({
          success: true,
          connections: [],
        });
      }

      throw fileError;
    }
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
