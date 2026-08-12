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
// Query Row Limit Constants
// ============================================================================

/** 'none' = no automatic limit; a number = injected when SQL has no explicit limit */
export type DefaultQueryLimit = number | 'none';

export const QUERY_LIMIT = {
  /** Preset options shown in the default-limit dropdown */
  PRESETS: [25, 50, 100, 200, 500] as const,

  /** Default when the user has never chosen (matches the AI prompt's historical LIMIT 100) */
  DEFAULT: PAGINATION.DEFAULT_QUERY_LIMIT as number,

  /** Minimum allowed custom value */
  MIN_CUSTOM: 1,

  /** Server-side cap for custom values (client input is untrusted) */
  MAX_CUSTOM: 100_000,
} as const;

/** Type guard for values read back from storage (localStorage / preferences JSONB). */
export function isDefaultQueryLimit(v: unknown): v is DefaultQueryLimit {
  return v === 'none' || (typeof v === 'number' && Number.isInteger(v) && v > 0);
}

// ============================================================================
// Dirty Read (READ UNCOMMITTED) Constants
// ============================================================================

export const DIRTY_READ = {
  /**
   * Off by default. Dirty reads return data that may never have been committed,
   * so this is opt-in per user — never a silent default.
   */
  DEFAULT: false,
} as const;

/**
 * Type guard for the dirty-read preference read back from storage.
 *
 * A guard is warranted even for a boolean: the value arrives from two untrusted
 * JSON sources. localStorage can hold `'"false"'`, which parses to the *truthy
 * string* `"false"` — without this check that becomes a silent, un-clearable
 * "always on". The preferences JSONB can likewise hold `1`, `null`, or a stale
 * shape from another version.
 */
export function isDirtyRead(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

// ============================================================================
// Query Timeout Constants
// ============================================================================

export const QUERY_TIMEOUT = {
  /**
   * Server-side ceiling on a single user query, applied per dialect (PostgreSQL
   * `statement_timeout`, MySQL `max_execution_time`, SQL Server
   * `requestTimeout`). This is the backstop for when cancellation is impossible
   * or fails: SQLite queries cannot be cancelled at all, the query registry is
   * process-local, and a kill can be refused (privileges) or lost (socket
   * error). Without it, such a query would run to completion unattended.
   */
  STATEMENT_MS: 120_000,
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

  /** Max number of past successful queries injected as few-shot examples */
  MAX_FEW_SHOT: 4,

  /** Max number of failed->revised corrections injected as anti-mistake hints */
  MAX_CORRECTIONS: 2,
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

  /** Executed-query history (device-local, capped) */
  QUERY_HISTORY: "query_history",

  /** Query accuracy counters (device-local when auth disabled) */
  QUERY_ACCURACY: "query_accuracy",

  /** Captured failed->revised SQL corrections (device-local, capped) */
  QUERY_CORRECTIONS: "query_corrections",

  /** Dismissed notification IDs */
  DISMISSED_NOTIFICATIONS: "dismissed_notifications",

  /** Default row limit for executed queries (device-local; preferences JSONB in auth mode) */
  DEFAULT_QUERY_LIMIT: "default_query_limit",

  /** Dirty-read (READ UNCOMMITTED) preference for executed queries (device-local; preferences JSONB in auth mode) */
  DIRTY_READ: "dirty_read",

  /** User's OpenAI API key (stored in sessionStorage) */
  USER_API_KEY: "user_openai_key",
} as const;

// Helper to get suggestions key for a specific connection
export const getSuggestionsKey = (connectionId: string) =>
  `suggestions_${connectionId}`;

// ============================================================================
// Query History
// ============================================================================

export const HISTORY = {
  /** Maximum number of query-history entries kept per browser (ring buffer, newest first) */
  MAX_ENTRIES: 200,
} as const;

// ============================================================================
// Query Corrections (learned failed->revised pairs)
// ============================================================================

export const CORRECTIONS = {
  /** Maximum number of correction entries kept per browser (ring buffer, newest first) */
  MAX_ENTRIES: 50,

  /**
   * Max corrections fetched from the team-wide pool per schema fingerprint (auth mode)
   * before relevance-scoring. Bounds work as the shared pool grows; newest first.
   */
  MAX_POOL_FETCH: 200,
} as const;

// ============================================================================
// Query Accuracy
// ============================================================================

export const ACCURACY = {
  /** Minimum number of recorded queries before the dashboard accuracy stat is shown */
  MIN_SAMPLE: 5,
} as const;

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

  // NOTE: there is deliberately no CSRF path-skip list here. CSRF exemptions
  // live in `shouldSkipCSRF()` (lib/csrf.ts), which exempts only `/api/auth/`.
  // A `CSRF_SKIP_PATHS` constant previously sat here listing /api/query/execute
  // and friends, but nothing ever read it — it wrongly implied those routes
  // were unprotected. `validateCSRFToken()` is an Origin-vs-Host check applied
  // to every state-changing route, including /api/query/execute and
  // /api/query/cancel.

  // NOTE: SQL safety is now enforced by the AST validator in
  // lib/database/sql-validator.ts (one read-only SELECT only) plus read-only
  // transaction execution in the adapters — not by a keyword blocklist.
} as const;
