import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Reads the server config file and returns the raw config data
 */
export async function getServerConfig(): Promise<{
  connections: DatabaseConnection[];
  schemaData?: Record<string, any>;
  savedReports?: any[];
  currentDbConnection?: DatabaseConnection;
} | null> {
  try {
    const configPath = join(process.cwd(), "config", "databases.json");
    const fileContent = await readFile(configPath, "utf-8");
    const config = JSON.parse(fileContent);

    let connections: DatabaseConnection[];

    if (Array.isArray(config)) {
      connections = config;
    } else if (config.connections && Array.isArray(config.connections)) {
      connections = config.connections;
    } else if (config.databaseConnections && Array.isArray(config.databaseConnections)) {
      connections = config.databaseConnections;
    } else {
      return null;
    }

    return {
      connections,
      schemaData: config.schemaData,
      savedReports: config.savedReports,
      currentDbConnection: config.currentDbConnection,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Looks up a server connection by ID and returns the full connection including password
 * This should only be used server-side for operations that need credentials
 */
export async function getServerConnectionCredentials(connectionId: string): Promise<DatabaseConnection | null> {
  const config = await getServerConfig();
  if (!config) return null;

  const connection = config.connections.find(conn => conn.id === connectionId);
  return connection || null;
}

/**
 * Strips sensitive data from a connection object for client-side use.
 * For server connections, we only expose what's needed for display and API calls.
 */
export function stripSensitiveData(connection: DatabaseConnection): Partial<DatabaseConnection> & { id: string } {
  // Only expose minimal info needed for display and functionality
  return {
    id: connection.id,
    name: connection.name,
    type: connection.type,
    description: connection.description,
    status: connection.status,
    createdAt: connection.createdAt,
    // These are needed for OpenAI integration
    schemaFileId: connection.schemaFileId,
    vectorStoreId: connection.vectorStoreId,
    // Empty/placeholder values to indicate server-side storage
    host: "••••••••",
    port: "••••",
    database: "••••••••",
    username: "••••••••",
    password: "",
  };
}
