import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/config/connections
 *
 * Reads database connections from a server-side config file.
 * This allows administrators to deploy pre-configured database connections
 * that will be shared across all users.
 *
 * Config file location: /config/databases.json in the project root
 *
 * Expected format:
 * {
 *   "connections": [
 *     {
 *       "id": "shared-prod-db",
 *       "name": "Production Database",
 *       "type": "postgresql",
 *       "host": "db.example.com",
 *       "port": "5432",
 *       "database": "myapp",
 *       "username": "readonly_user",
 *       "password": "",
 *       "description": "Production database (read-only)",
 *       "status": "disconnected",
 *       "createdAt": "2024-01-01T00:00:00Z"
 *     }
 *   ]
 * }
 */
export async function GET() {
  try {
    // Look for config file in the project root
    const configPath = join(process.cwd(), "config", "databases.json");

    try {
      const fileContent = await readFile(configPath, "utf-8");
      const config = JSON.parse(fileContent);

      // Validate the config structure
      if (!config.connections || !Array.isArray(config.connections)) {
        return NextResponse.json(
          { error: "Invalid config file structure. Expected 'connections' array." },
          { status: 400 }
        );
      }

      // Mark all connections as coming from server and ensure they're disconnected initially
      const serverConnections = config.connections.map((conn: DatabaseConnection) => ({
        ...conn,
        source: "server" as const,
        status: "disconnected" as const,
      }));

      return NextResponse.json({
        success: true,
        connections: serverConnections,
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
