/**
 * Application-wide constants.
 *
 * Centralizes magic numbers and configuration values to:
 * - Make the codebase more readable
 * - Ensure consistency across the application
 * - Make values easier to modify
 */

// ============================================================================
// Timing Constants
// ============================================================================

export const TIMING = {
  /** Rate limit window in milliseconds (24 hours) */
  RATE_LIMIT_WINDOW_MS: 24 * 60 * 60 * 1000,

  /** Interval for rate limit store cleanup (1 hour) */
  RATE_LIMIT_CLEANUP_INTERVAL_MS: 60 * 60 * 1000,

  /** Polling interval for schema introspection status (2 seconds) */
  SCHEMA_POLL_INTERVAL_MS: 2000,

  /** Delay between batch operations to avoid rate limiting (1 second) */
  BATCH_DELAY_MS: 1000,

  /** Debounce delay for search inputs */
  SEARCH_DEBOUNCE_MS: 300,

  /** Toast notification duration */
  TOAST_DURATION_MS: 5000,
} as const;

// ============================================================================
// Pagination Constants
// ============================================================================

export const PAGINATION = {
  /** Default page size for tables */
  DEFAULT_PAGE_SIZE: 25,

  /** Available page size options */
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100] as const,

  /** Default limit for SQL queries */
  DEFAULT_QUERY_LIMIT: 100,
} as const;

// ============================================================================
// AI/OpenAI Constants
// ============================================================================

export const AI = {
  /** Number of tables to process in each batch for description generation */
  DESCRIPTION_BATCH_SIZE: 5,

  /** Maximum retries for failed AI requests */
  MAX_RETRIES: 3,

  /** Confidence threshold for showing warnings */
  LOW_CONFIDENCE_THRESHOLD: 0.5,
} as const;

// ============================================================================
// Validation Constants
// ============================================================================

export const VALIDATION = {
  /** Minimum length for report names */
  MIN_REPORT_NAME_LENGTH: 3,

  /** Maximum length for report names */
  MAX_REPORT_NAME_LENGTH: 100,

  /** Maximum length for descriptions */
  MAX_DESCRIPTION_LENGTH: 500,

  /** Maximum file size for schema uploads (10MB) */
  MAX_SCHEMA_FILE_SIZE: 10 * 1024 * 1024,
} as const;

// ============================================================================
// LocalStorage Keys
// ============================================================================

export const STORAGE_KEYS = {
  /** All saved database connections */
  DATABASE_CONNECTIONS: "databaseConnections",

  /** Currently active connection */
  CURRENT_CONNECTION: "currentDbConnection",

  /** Schemas for each connection */
  CONNECTION_SCHEMAS: "connectionSchemas",

  /** Saved reports */
  SAVED_REPORTS: "saved_reports",

  /** Dismissed notification IDs */
  DISMISSED_NOTIFICATIONS: "dismissed_notifications",

  /** User's OpenAI API key (stored in sessionStorage) */
  USER_API_KEY: "user_openai_key",
} as const;

// Helper to get suggestions key for a specific connection
export const getSuggestionsKey = (connectionId: string) =>
  `suggestions_${connectionId}`;

// ============================================================================
// API Rate Limits
// ============================================================================

export const RATE_LIMITS = {
  /** Default demo rate limit (requests per day per IP) */
  DEFAULT_DEMO_LIMIT: 50,
} as const;

// ============================================================================
// Chart Configuration
// ============================================================================

export const CHART = {
  /** Default chart colors palette */
  DEFAULT_COLORS: [
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff7300",
    "#0088fe",
    "#00c49f",
  ] as const,

  /** Minimum data points for certain chart types */
  MIN_POINTS_FOR_LINE: 2,
  MIN_POINTS_FOR_PIE: 1,
} as const;

// ============================================================================
// Security Constants
// ============================================================================

export const SECURITY = {
  /** CSRF-protected HTTP methods */
  CSRF_PROTECTED_METHODS: ["POST", "PUT", "PATCH", "DELETE"] as const,

  /** Paths to skip CSRF validation */
  CSRF_SKIP_PATHS: [
    "/api/connection/test",
    "/api/query/execute",
    "/api/schema/introspect",
    "/api/schema/start-introspection",
  ] as const,

  /** Dangerous SQL keywords to block */
  DANGEROUS_SQL_KEYWORDS: [
    "DROP",
    "DELETE",
    "UPDATE",
    "INSERT",
    "ALTER",
    "CREATE",
    "TRUNCATE",
  ] as const,
} as const;
