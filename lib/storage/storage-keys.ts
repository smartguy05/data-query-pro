/**
 * Centralized Storage Keys
 *
 * This file contains all storage keys used throughout the application.
 * Centralizing keys helps prevent typos and makes it easier to:
 * - Track what data is stored
 * - Migrate to a database (map keys to database tables/columns)
 * - Refactor key names consistently
 */

export const StorageKeys = {
  // Database connection management
  DATABASE_CONNECTIONS: 'databaseConnections',
  CURRENT_DB_CONNECTION: 'currentDbConnection',
  CONNECTION_SCHEMAS: 'connectionSchemas',

  // Reports management
  SAVED_REPORTS: 'saved_reports',

  // Dashboard notifications
  DISMISSED_NOTIFICATIONS: 'dismissed_notifications',

  // Dynamic keys (functions to generate keys with parameters)

  /**
   * Get the suggestions key for a specific connection
   * @param connectionId The database connection ID
   */
  suggestions: (connectionId: string): string => `suggestions_${connectionId}`,

  /**
   * Get the schema key for a specific connection
   * @param connectionId The database connection ID
   */
  schema: (connectionId: string): string => `schema_${connectionId}`,
} as const

/**
 * Storage key type - useful for type checking
 */
export type StorageKey = typeof StorageKeys[keyof typeof StorageKeys] | string
