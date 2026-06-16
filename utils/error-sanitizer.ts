/**
 * Error sanitization utility for preventing sensitive information disclosure.
 *
 * Database errors often contain schema information, table names, column names,
 * and other details that could aid attackers. This utility maps known error
 * patterns to safe, user-friendly messages.
 */

export interface SanitizedError {
  /** User-friendly error message */
  message: string;
  /** Error code for programmatic handling */
  code?: string;
  /** Whether this is a user error (4xx) vs server error (5xx) */
  isUserError: boolean;
  /**
   * The specific, user-safe detail from the database (e.g. which column or
   * table). Only populated for query-logic errors (user errors), never for
   * connection/auth errors which may contain credentials or host info.
   */
  detail?: string;
}

/**
 * Known safe error patterns and their mappings.
 * These patterns are matched against database error messages.
 */
const SAFE_ERROR_PATTERNS: {
  pattern: RegExp;
  message: string;
  code: string;
  isUserError: boolean;
}[] = [
  // Column/table not found errors (user errors)
  {
    pattern: /column[^"]*"?[\w]+"?[^"]*does not exist/i,
    message: 'Column not found in table',
    code: 'COLUMN_NOT_FOUND',
    isUserError: true,
  },
  {
    pattern: /relation[^"]*"?[\w]+"?[^"]*does not exist/i,
    message: 'Table not found in database',
    code: 'TABLE_NOT_FOUND',
    isUserError: true,
  },
  {
    pattern: /unknown column/i,
    message: 'Column not found in table',
    code: 'COLUMN_NOT_FOUND',
    isUserError: true,
  },
  {
    pattern: /table[^"]*"?[\w]+"?[^"]*doesn't exist/i,
    message: 'Table not found in database',
    code: 'TABLE_NOT_FOUND',
    isUserError: true,
  },
  // SQLite
  {
    pattern: /no such column/i,
    message: 'Column not found in table',
    code: 'COLUMN_NOT_FOUND',
    isUserError: true,
  },
  {
    pattern: /no such table/i,
    message: 'Table not found in database',
    code: 'TABLE_NOT_FOUND',
    isUserError: true,
  },
  // SQL Server
  {
    pattern: /invalid column name/i,
    message: 'Column not found in table',
    code: 'COLUMN_NOT_FOUND',
    isUserError: true,
  },
  {
    pattern: /invalid object name/i,
    message: 'Table not found in database',
    code: 'TABLE_NOT_FOUND',
    isUserError: true,
  },
  {
    pattern: /ambiguous column/i,
    message: 'Ambiguous column reference',
    code: 'AMBIGUOUS_COLUMN',
    isUserError: true,
  },

  // Syntax errors (user errors)
  {
    pattern: /syntax error/i,
    message: 'Invalid SQL syntax',
    code: 'SYNTAX_ERROR',
    isUserError: true,
  },
  {
    pattern: /unexpected token/i,
    message: 'Invalid SQL syntax',
    code: 'SYNTAX_ERROR',
    isUserError: true,
  },

  // Permission errors (user errors)
  {
    pattern: /permission denied/i,
    message: 'Insufficient database permissions',
    code: 'PERMISSION_DENIED',
    isUserError: true,
  },
  {
    pattern: /access denied/i,
    message: 'Insufficient database permissions',
    code: 'PERMISSION_DENIED',
    isUserError: true,
  },

  // Connection errors (server errors)
  {
    pattern: /connection refused/i,
    message: 'Database connection failed',
    code: 'CONNECTION_FAILED',
    isUserError: false,
  },
  {
    pattern: /connection reset/i,
    message: 'Database connection was interrupted',
    code: 'CONNECTION_RESET',
    isUserError: false,
  },
  {
    pattern: /ECONNREFUSED/i,
    message: 'Database connection failed',
    code: 'CONNECTION_FAILED',
    isUserError: false,
  },
  {
    pattern: /ETIMEDOUT/i,
    message: 'Database connection timed out',
    code: 'CONNECTION_TIMEOUT',
    isUserError: false,
  },
  {
    pattern: /not connected/i,
    message: 'Not connected to database',
    code: 'NOT_CONNECTED',
    isUserError: false,
  },

  // Timeout errors (could be either)
  {
    pattern: /timeout|timed out/i,
    message: 'Query timed out',
    code: 'TIMEOUT',
    isUserError: false,
  },

  // Data type errors (user errors)
  {
    pattern: /invalid input syntax/i,
    message: 'Invalid data format',
    code: 'INVALID_INPUT',
    isUserError: true,
  },
  {
    pattern: /data type mismatch/i,
    message: 'Data type mismatch',
    code: 'TYPE_MISMATCH',
    isUserError: true,
  },

  // Constraint violations (user errors)
  {
    pattern: /unique constraint/i,
    message: 'Duplicate value not allowed',
    code: 'DUPLICATE_VALUE',
    isUserError: true,
  },
  {
    pattern: /foreign key constraint/i,
    message: 'Referenced record not found',
    code: 'FK_VIOLATION',
    isUserError: true,
  },
  {
    pattern: /check constraint/i,
    message: 'Value does not meet requirements',
    code: 'CHECK_VIOLATION',
    isUserError: true,
  },

  // Authentication errors (server errors - don't reveal details)
  {
    pattern: /authentication failed/i,
    message: 'Database authentication failed',
    code: 'AUTH_FAILED',
    isUserError: false,
  },
  {
    pattern: /password authentication failed/i,
    message: 'Database authentication failed',
    code: 'AUTH_FAILED',
    isUserError: false,
  },
];

/**
 * Cleans up a raw database driver message for display to the user.
 *
 * The raw message already names the offending column/table/constraint, which is
 * exactly what the user needs. We only normalize whitespace, strip noisy
 * prefixes some drivers add, and cap the length to keep the UI tidy.
 */
function normalizeDbDetail(rawMessage: string): string {
  let detail = rawMessage
    .replace(/\s+/g, ' ')
    .trim()
    // Drop common driver prefixes (e.g. "error: ", "ER_BAD_FIELD_ERROR: ")
    .replace(/^(error|err|[A-Z][A-Z0-9_]+):\s*/i, '')
    .trim();

  // Capitalize the first letter for a tidier message.
  if (detail.length > 0) {
    detail = detail.charAt(0).toUpperCase() + detail.slice(1);
  }

  const MAX_LENGTH = 500;
  if (detail.length > MAX_LENGTH) {
    detail = `${detail.slice(0, MAX_LENGTH)}…`;
  }

  return detail;
}

/**
 * Sanitizes a database error for safe client exposure.
 *
 * For query-logic errors (user errors) the real driver message — which names
 * the specific column, table, constraint, etc. — is surfaced, since the user is
 * querying their own database and already sees its full schema. Connection,
 * authentication, and unrecognized errors stay generic because they may contain
 * credentials or host details.
 *
 * @param error - The error to sanitize
 * @returns A sanitized error with a safe message
 */
export function sanitizeDbError(error: unknown): SanitizedError {
  // Handle non-Error values
  if (!(error instanceof Error)) {
    console.error('[DB_ERROR] Non-error value:', error);
    return {
      message: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      isUserError: false,
    };
  }

  const errorMessage = error.message;

  // Check for known safe patterns
  for (const { pattern, message, code, isUserError } of SAFE_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      // Log the full error server-side for debugging
      console.error(`[DB_ERROR] ${code}:`, errorMessage);

      // For user errors (bad column/table/syntax/constraint in the query), the
      // raw message safely names the offending identifier and is far more
      // helpful than the generic label — surface it to the user and the
      // auto-revise flow. Server-side errors stay generic.
      if (isUserError) {
        const detail = normalizeDbDetail(errorMessage);
        return { message: detail || message, code, isUserError, detail };
      }

      return { message, code, isUserError };
    }
  }

  // Unknown error - log full details server-side but return generic message
  console.error('[DB_ERROR] Unrecognized error:', errorMessage);
  if (error.stack) {
    console.error('[DB_ERROR] Stack trace:', error.stack);
  }

  return {
    message: 'Failed to execute database operation',
    code: 'DATABASE_ERROR',
    isUserError: false,
  };
}

/**
 * Sanitizes an OpenAI API error for safe client exposure.
 *
 * @param error - The error to sanitize
 * @returns A sanitized error with a safe message
 */
export function sanitizeOpenAIError(error: unknown): SanitizedError {
  if (!(error instanceof Error)) {
    console.error('[OPENAI_ERROR] Non-error value:', error);
    return {
      message: 'AI service error',
      code: 'AI_ERROR',
      isUserError: false,
    };
  }

  const errorMessage = error.message;

  // Check for specific OpenAI error patterns
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return {
      message: 'AI service is temporarily busy. Please try again later.',
      code: 'AI_RATE_LIMIT',
      isUserError: false,
    };
  }

  if (errorMessage.includes('401') || errorMessage.includes('invalid_api_key')) {
    return {
      message: 'Invalid API key',
      code: 'INVALID_API_KEY',
      isUserError: true,
    };
  }

  if (errorMessage.includes('insufficient_quota')) {
    return {
      message: 'API quota exceeded',
      code: 'QUOTA_EXCEEDED',
      isUserError: true,
    };
  }

  if (errorMessage.includes('context_length_exceeded')) {
    return {
      message: 'Query is too complex. Try simplifying your request.',
      code: 'CONTEXT_TOO_LONG',
      isUserError: true,
    };
  }

  // Log and return generic message
  console.error('[OPENAI_ERROR]:', errorMessage);
  return {
    message: 'AI service error',
    code: 'AI_ERROR',
    isUserError: false,
  };
}
