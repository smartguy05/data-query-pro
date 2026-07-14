/**
 * SQL validator that allows exactly one read-only query.
 *
 * This replaces the old regex keyword blocklist (DROP/DELETE/...), which was
 * trivially bypassable via comments, write-via-function, or stacked statements.
 *
 * Two layers:
 *  1. AST (node-sql-parser) — the primary, precise path. When the SQL parses,
 *     we require a single statement of type SELECT (CTEs included).
 *  2. Heuristic fallback — node-sql-parser's per-dialect grammars are incomplete
 *     and reject plenty of *valid* SQL (e.g. PostgreSQL `TIMESTAMP WITH TIME ZONE
 *     '...'` / `timestamptz '...'` typed literals). Rather than fail closed on
 *     every such query, when the parser cannot parse at all we apply a
 *     conservative read-only check: after stripping comments / string literals /
 *     quoted identifiers, the SQL must be a single statement that starts with
 *     SELECT or WITH and contains no write/DDL keyword anywhere. This blocks
 *     stacked statements, data-modifying CTEs, and `SELECT INTO`.
 *
 * Defense-in-depth: queries also execute inside a read-only transaction in the
 * adapters, so even a write that slipped past this validator cannot mutate data
 * (PG/MySQL/SQLite enforce it strictly; SQL Server rolls back).
 */
import { Parser } from "node-sql-parser";
import type { DatabaseType } from "./types";

export interface SqlValidationResult {
  valid: boolean;
  error?: string;
  statementType?: string;
}

// Map our DatabaseType to node-sql-parser's `database` option.
export const DIALECT_MAP: Record<DatabaseType, string> = {
  postgresql: "postgresql",
  mysql: "mysql",
  sqlserver: "transactsql",
  sqlite: "sqlite",
};

const parser = new Parser();

// Write / DDL / session keywords that must never appear in a read-only query.
// `into` blocks `SELECT ... INTO newtable` (which creates a table).
const WRITE_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|merge|replace|call|exec|execute|into|vacuum|comment|copy|set|lock|reindex|cluster|analyze)\b/i;

/** Remove comments, string literals, and quoted identifiers so keyword/`;` scans are accurate. */
export function stripNonCode(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ") // block comments
    .replace(/--[^\n]*/g, " ") // line comments
    .replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, " 'str' ") // dollar-quoted strings
    .replace(/'(?:''|[^'])*'/g, " s ") // single-quoted strings
    .replace(/"(?:""|[^"])*"/g, " id "); // double-quoted identifiers
}

/** Conservative read-only check used only when the AST parser cannot parse the SQL. */
function heuristicReadOnly(sql: string): boolean {
  const core = stripNonCode(sql).trim().replace(/;\s*$/, ""); // allow one trailing ;
  if (core.includes(";")) return false; // multiple statements
  if (!/^\(*\s*(select|with)\b/i.test(core)) return false; // must read
  if (WRITE_KEYWORDS.test(core)) return false; // no write/DDL anywhere
  return true;
}

/**
 * Validates that `sql` is a single read-only query for the given dialect.
 * Returns `{ valid: true }` for a SELECT/CTE, otherwise `{ valid: false, error }`.
 */
export function validateReadOnlySql(sql: string, dbType: DatabaseType): SqlValidationResult {
  const dialect = DIALECT_MAP[dbType] ?? "postgresql";

  let ast: unknown;
  try {
    ast = parser.astify(sql, { database: dialect });
  } catch {
    // Parser couldn't handle it — fall back to the conservative read-only check
    // rather than rejecting valid-but-unparseable SQL.
    if (heuristicReadOnly(sql)) {
      return { valid: true, statementType: "select" };
    }
    return {
      valid: false,
      error: "Only a single read-only SELECT statement is allowed.",
    };
  }

  const statements = Array.isArray(ast) ? ast : [ast];

  if (statements.length === 0) {
    return { valid: false, error: "No SQL statement found." };
  }
  if (statements.length > 1) {
    return {
      valid: false,
      error: "Only a single statement is allowed; multiple statements were detected.",
    };
  }

  const stmt = statements[0] as { type?: string } | null;
  const type = (stmt?.type ?? "").toLowerCase();

  if (type !== "select") {
    return {
      valid: false,
      error: `Only read-only SELECT queries are allowed (detected: ${type || "unknown"}).`,
      statementType: type,
    };
  }

  return { valid: true, statementType: type };
}
