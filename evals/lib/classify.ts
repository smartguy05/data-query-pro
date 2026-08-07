// Failure classification for generate + execute responses. String signals are
// verified against app/api/query/generate/route.ts:
//   - outer-catch mock fallback: HTTP 200, confidence 0.3, warning contains
//     "This is a mock response - configure OpenAI API key ..."
//   - JSON parse fallback: sql "SELECT 1 as parsing_error" or warning
//     "Could not parse OpenAI response as JSON. Raw response: ..."

import type { FailureClass, GenerateResponse } from "../types";

function joinWarnings(warnings: unknown[] | undefined): string {
  if (!Array.isArray(warnings)) return "";
  return warnings.map((w) => (typeof w === "string" ? w : String(w ?? ""))).join(" | ");
}

/**
 * Classifies a /api/query/generate response. Returns null when the response
 * looks like real generated SQL and the trial should proceed to execution.
 */
export function classifyGeneration(
  status: number,
  body: GenerateResponse
): FailureClass | null {
  if (status !== 200) return "generation-error";

  const warnings = joinWarnings(body.warnings);

  // Route's outer catch: HTTP 200 mock querying information_schema.columns.
  // The warning string is the primary signal.
  if (warnings.includes("mock response")) return "generation-mock-fallback";

  // Non-JSON OpenAI output fallback path.
  if (
    body.sql === "SELECT 1 as parsing_error" ||
    warnings.includes("Could not parse OpenAI response as JSON")
  ) {
    return "json-parse-fallback";
  }

  if (typeof body.sql !== "string" || body.sql.trim() === "") return "generation-error";

  return null;
}

/**
 * Classifies a /api/query/execute response. Returns null when the query ran
 * and returned rows — the result comparison then decides pass or
 * "result-mismatch".
 */
export function classifyExecution(
  status: number,
  body: { rowCount?: number; error?: string }
): FailureClass | null {
  if (status === 400) return "validation-rejection";
  if (status !== 200) return "execution-error";
  if (body.rowCount === 0) return "empty-result";
  return null;
}
