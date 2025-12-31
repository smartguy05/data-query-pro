import postgres from 'postgres';

// Environment variables for multi-user database connection
const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
const POSTGRES_PORT = parseInt(process.env.POSTGRES_PORT || '5432', 10);
const POSTGRES_DATABASE = process.env.POSTGRES_DATABASE || 'dataquery_pro';
const POSTGRES_USERNAME = process.env.POSTGRES_USERNAME || 'postgres';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || '';

// Connection pool configuration
const POOL_MAX = parseInt(process.env.POSTGRES_POOL_MAX || '10', 10);
const POOL_IDLE_TIMEOUT = parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30', 10);
const CONNECT_TIMEOUT = parseInt(process.env.POSTGRES_CONNECT_TIMEOUT || '10', 10);

// Singleton connection pool
let pool: postgres.Sql | null = null;

/**
 * Get or create the PostgreSQL connection pool for the multi-user database.
 * This is used for storing user data, connections, reports, etc.
 * NOT for querying user databases - that uses separate connections.
 */
export function getPool(): postgres.Sql {
  if (!pool) {
    pool = postgres({
      host: POSTGRES_HOST,
      port: POSTGRES_PORT,
      database: POSTGRES_DATABASE,
      username: POSTGRES_USERNAME,
      password: POSTGRES_PASSWORD,
      max: POOL_MAX,
      idle_timeout: POOL_IDLE_TIMEOUT,
      connect_timeout: CONNECT_TIMEOUT,
      // Transform column names from snake_case to camelCase
      transform: {
        column: (col) => {
          // Convert snake_case to camelCase
          return col.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        },
      },
    });
  }
  return pool;
}

/**
 * Close the connection pool gracefully.
 * Call this during application shutdown.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Test the database connection.
 * Returns true if connection is successful, false otherwise.
 */
export async function testConnection(): Promise<boolean> {
  try {
    const sql = getPool();
    await sql`SELECT 1 as test`;
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

/**
 * Execute a raw SQL query with parameters.
 * Use this for complex queries that don't fit the typed helpers.
 */
export async function query<T extends object>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const sql = getPool();
  return sql<T[]>(strings, ...values);
}

/**
 * Execute a transaction with multiple queries.
 */
export async function transaction<T>(
  callback: (sql: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  const sql = getPool();
  return sql.begin(callback);
}

// Re-export the postgres type for use in other modules
export type { postgres };
