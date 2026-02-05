/**
 * Shared connection validation utilities for database API routes.
 *
 * This module centralizes the common logic for:
 * - Resolving server connection credentials
 * - Resolving app DB credentials (when auth is enabled)
 * - Validating database types
 * - Building adapter configurations
 * - Creating database adapters
 */

import {
  DatabaseAdapterFactory,
  type AdapterConnectionConfig,
  type DatabaseType,
  type IDatabaseAdapter
} from "@/lib/database";
import { getServerConnectionCredentials } from "@/lib/server-config";

/**
 * Raw connection input from API requests.
 * Can be either a full connection with credentials or a server reference.
 */
export interface ConnectionInput {
  id?: string;
  source?: "local" | "server";
  type?: string;
  host?: string;
  port?: string | number;
  database?: string;
  username?: string;
  password?: string;
  filepath?: string; // For SQLite
}

/**
 * Result of connection validation - either success with adapter/config or error.
 */
export type ConnectionValidationResult =
  | {
      success: true;
      adapter: IDatabaseAdapter;
      config: AdapterConnectionConfig;
      dbType: DatabaseType;
    }
  | {
      success: false;
      error: string;
      statusCode: number;
    };

/**
 * Options for connection validation.
 */
export interface ValidationOptions {
  /** Whether to validate required fields for non-SQLite databases. Default: true */
  validateRequiredFields?: boolean;
  /** Whether to skip validation for server connections (already validated). Default: true */
  skipServerValidation?: boolean;
  /** Auth context - when provided, credentials are resolved from app DB */
  authUserId?: string;
}

/**
 * Resolves the full connection details, looking up server credentials if needed.
 * When auth is enabled and authUserId is provided, looks up app DB credentials
 * for non-server connections.
 *
 * @param connection - The connection input from the request
 * @param authUserId - The authenticated user ID (when auth is enabled)
 * @returns The resolved connection details or null if connection not found
 */
async function resolveConnectionDetails(
  connection: ConnectionInput,
  authUserId?: string
): Promise<ConnectionInput | null> {
  // Server connections always resolve from config file
  if (connection.source === "server") {
    if (!connection.id) {
      return null;
    }
    const serverConnection = await getServerConnectionCredentials(connection.id);
    return serverConnection;
  }

  // When auth is enabled, resolve credentials from app database
  if (authUserId && connection.id) {
    try {
      const { getConnectionCredentials } = await import("@/lib/db/repositories/connection-repository");
      const creds = await getConnectionCredentials(authUserId, connection.id);
      if (creds) {
        return {
          ...connection,
          host: creds.host,
          port: creds.port,
          database: creds.database,
          username: creds.username,
          password: creds.password,
          filepath: creds.filepath,
          type: creds.type,
        };
      }
    } catch {
      // Fall through to use client-supplied data
    }
  }

  return connection;
}

/**
 * Builds the adapter connection config from validated connection details.
 *
 * @param connectionDetails - The validated connection details
 * @returns The adapter configuration
 */
function buildAdapterConfig(connectionDetails: ConnectionInput): AdapterConnectionConfig {
  return {
    host: connectionDetails.host || "",
    port: parseInt(String(connectionDetails.port || "0"), 10),
    database: connectionDetails.database || "",
    username: connectionDetails.username || "",
    password: connectionDetails.password || "",
    filepath: connectionDetails.filepath,
    ssl:
      connectionDetails.host?.includes("azure.com") ||
      connectionDetails.host?.includes("azure"),
  };
}

/**
 * Validates a database connection request and returns an adapter ready for use.
 *
 * This function:
 * 1. Resolves server connection credentials if needed
 * 2. Resolves app DB credentials if auth is enabled
 * 3. Validates the database type is supported
 * 4. Validates required fields (host, database, username) for non-SQLite
 * 5. Creates the appropriate database adapter
 * 6. Builds the adapter configuration
 *
 * @param connection - The connection input from the API request
 * @param options - Validation options
 * @returns A validation result with adapter/config or error details
 */
export async function validateConnection(
  connection: ConnectionInput | null | undefined,
  options: ValidationOptions = {}
): Promise<ConnectionValidationResult> {
  const { validateRequiredFields = true, skipServerValidation = true, authUserId } = options;

  // Check connection is provided
  if (!connection) {
    return {
      success: false,
      error: "Connection data is required",
      statusCode: 400,
    };
  }

  // Resolve server connection credentials if needed
  const connectionDetails = await resolveConnectionDetails(connection, authUserId);
  if (!connectionDetails) {
    return {
      success: false,
      error: "Server connection not found",
      statusCode: 404,
    };
  }

  // Validate database type
  const dbType = connectionDetails.type as string;
  if (!DatabaseAdapterFactory.isSupported(dbType)) {
    return {
      success: false,
      error: `Unsupported database type: ${dbType}`,
      statusCode: 400,
    };
  }

  // For SQLite, filepath is required
  if (dbType === "sqlite" && !connectionDetails.filepath) {
    return {
      success: false,
      error: "SQLite requires a file path",
      statusCode: 400,
    };
  }

  // Validate required fields for non-SQLite databases
  // Skip for server connections as they're already validated
  const shouldValidateFields =
    validateRequiredFields &&
    dbType !== "sqlite" &&
    !(skipServerValidation && connection.source === "server");

  if (shouldValidateFields) {
    if (!connectionDetails.host || !connectionDetails.database || !connectionDetails.username) {
      return {
        success: false,
        error: "Host, database, and username are required",
        statusCode: 400,
      };
    }
  }

  // Create adapter
  const adapter = DatabaseAdapterFactory.create(dbType as DatabaseType);

  // Build config
  const config = buildAdapterConfig(connectionDetails);

  return {
    success: true,
    adapter,
    config,
    dbType: dbType as DatabaseType,
  };
}
