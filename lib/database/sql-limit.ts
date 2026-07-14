/**
 * Dialect-aware default row-limit injection for executed queries.
 *
 * Injects the user's chosen default limit ONLY when the statement has no
 * explicit LIMIT/TOP/FETCH of its own — an explicit limit in the SQL always
 * wins. This is a convenience cap, not a security control, so every uncertain
 * path fails OPEN (the SQL runs unmodified); the worst case is today's
 * behavior of an unlimited result set.
 *
 * Strategy:
 *  - Detection is AST-first (node-sql-parser, same dialect map as the
 *    validator), checking the top-level statement only — a LIMIT inside a
 *    subquery does not count as an existing limit.
 *  - Injection for postgresql/mysql/sqlite is a plain string append of
 *    `LIMIT n`, which is always valid at end-of-statement (even after UNION
 *    or ORDER BY) and avoids sqlify round-trip mangling.
 *  - SQL Server has no appendable form, so TOP is set on the AST and the
 *    statement re-emitted via sqlify, guarded by a re-parse of the output.
 *  - When the parser cannot parse the SQL at all (its grammars are
 *    incomplete — see sql-validator.ts), fall back to a conservative keyword
 *    scan: append only when no limit-like keyword appears anywhere; for
 *    SQL Server skip injection entirely.
 */
import { Parser } from "node-sql-parser";
import { DIALECT_MAP, stripNonCode } from "./sql-validator";
import type { DatabaseType } from "./types";
import { QUERY_LIMIT } from "@/lib/constants";

export interface LimitApplication {
  /** The SQL to execute (rewritten when `applied` is true, otherwise the original). */
  sql: string;
  applied: boolean;
  reason?: "existing-limit" | "parse-failed" | "unsupported";
}

const parser = new Parser();

// PG `FETCH FIRST n ROWS ONLY` / T-SQL `OFFSET ... FETCH NEXT n ROWS ONLY` —
// grammars don't reliably surface these on the AST, so scan the stripped text.
const FETCH_CLAUSE = /\bfetch\s+(first|next)\b/i;

/**
 * Validates an untrusted client-supplied limit value.
 * Returns the integer limit, or null for absent/'none'/invalid values.
 */
export function sanitizeLimit(value: unknown): number | null {
  if (value === undefined || value === null || value === "none") return null;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(n)) return null;
  if (n < QUERY_LIMIT.MIN_CUSTOM || n > QUERY_LIMIT.MAX_CUSTOM) return null;
  return n;
}

/** Appends `LIMIT n` after stripping one trailing semicolon (LIMIT must precede it). */
function appendLimit(sql: string, limit: number): string {
  return `${sql.replace(/;\s*$/, "").trimEnd()}\nLIMIT ${limit}`;
}

/**
 * Injects a default row limit into a single read-only SELECT (the execute
 * route validates that shape first). Returns the SQL unchanged when it
 * already has a top-level limit or when injection cannot be done safely.
 */
export function applyDefaultRowLimit(
  sql: string,
  dbType: DatabaseType,
  limit: number
): LimitApplication {
  const dialect = DIALECT_MAP[dbType] ?? "postgresql";

  // Belt-and-braces for FETCH FIRST/NEXT regardless of whether the AST parses.
  if (FETCH_CLAUSE.test(stripNonCode(sql))) {
    return { sql, applied: false, reason: "existing-limit" };
  }

  let ast: unknown;
  try {
    ast = parser.astify(sql, { database: dialect });
  } catch {
    // Parser can't handle this SQL. Conservative fallback: only append when no
    // limit-like keyword appears anywhere (a subquery-only LIMIT means we skip
    // the cap rather than risk double-limiting).
    if (dbType === "sqlserver") {
      return { sql, applied: false, reason: "parse-failed" };
    }
    if (/\blimit\b/i.test(stripNonCode(sql))) {
      return { sql, applied: false, reason: "parse-failed" };
    }
    return { sql: appendLimit(sql, limit), applied: true };
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  type SelectNode = {
    limit?: { value?: unknown[] } | null;
    top?: unknown;
    fetch?: unknown;
    _next?: SelectNode | null;
  };
  const stmt = statements[0] as SelectNode | null;
  if (!stmt) {
    return { sql, applied: false, reason: "unsupported" };
  }

  // Existing limit anywhere on the top-level statement? UNION chains link via
  // `_next`, and the parser hangs a trailing LIMIT (which SQL applies to the
  // whole union) on the LAST node — so walk the chain, not just the root.
  for (let node: SelectNode | null | undefined = stmt; node; node = node._next) {
    const limitValues = node.limit?.value;
    if (Array.isArray(limitValues) && limitValues.length > 0) {
      return { sql, applied: false, reason: "existing-limit" };
    }
    if (node.top || node.fetch) {
      return { sql, applied: false, reason: "existing-limit" };
    }
  }

  if (dbType === "sqlserver") {
    try {
      (stmt as Record<string, unknown>).top = { value: limit, percent: null, parentheses: true };
      const rewritten = parser.sqlify(statements[0] as never, { database: dialect });
      // Guard: sqlify output must itself parse, or we run the original.
      parser.astify(rewritten, { database: dialect });
      return { sql: rewritten, applied: true };
    } catch {
      return { sql, applied: false, reason: "unsupported" };
    }
  }

  return { sql: appendLimit(sql, limit), applied: true };
}
