// Verifies every golden in dataset.ts against the live dev server.
// Run from repo root: npx tsx evals/verify-goldens.ts
//
// Per question it POSTs goldenSql to /api/query/execute (same AST read-only
// validator the eval uses) and asserts:
//   - HTTP 200 and rowCount >= 1 (no golden may return an empty result)
//   - scalar goldens return exactly 1 row and >= 1 column
//   - ordered goldens produce an identical row order across two executions

import { EXTENDED_QUESTIONS, QUESTIONS } from "./dataset";

// Always verify the COMBINED pool — extended goldens must stay green even
// though the default eval run only sweeps the core set.
const ALL_QUESTIONS = [...QUESTIONS, ...EXTENDED_QUESTIONS];

const BASE_URL = process.env.EVAL_BASE_URL ?? "http://localhost:3000";

const CONNECTION = {
  type: "postgresql",
  host: "localhost",
  port: 5433,
  database: "cloudmetrics",
  username: "demo",
  password: "demo",
};

interface ExecuteResponse {
  columns?: string[];
  rows?: string[][];
  rowCount?: number;
  error?: string;
}

async function execute(sql: string): Promise<{ status: number; body: ExecuteResponse }> {
  const res = await fetch(`${BASE_URL}/api/query/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, connection: CONNECTION, defaultLimit: "none" }),
  });
  const body = (await res.json().catch(() => ({}))) as ExecuteResponse;
  return { status: res.status, body };
}

async function main(): Promise<void> {
  let failures = 0;

  for (const q of ALL_QUESTIONS) {
    const problems: string[] = [];
    const { status, body } = await execute(q.goldenSql);
    const rowCount = body.rowCount ?? 0;

    if (status !== 200) {
      problems.push(`HTTP ${status}: ${body.error ?? "unknown error"}`);
    } else if (rowCount === 0) {
      problems.push("rowCount === 0 (goldens must return >= 1 row)");
    }

    if (status === 200 && q.mode === "scalar") {
      if (rowCount !== 1) problems.push(`scalar golden returned ${rowCount} rows (expected 1)`);
      if ((body.columns?.length ?? 0) < 1) problems.push("scalar golden returned 0 columns");
    }

    if (status === 200 && q.mode === "ordered") {
      const second = await execute(q.goldenSql);
      const a = JSON.stringify(body.rows ?? []);
      const b = JSON.stringify(second.body.rows ?? []);
      if (second.status !== 200) {
        problems.push(`ordered re-execution failed: HTTP ${second.status}`);
      } else if (a !== b) {
        problems.push("ordered golden is not deterministic (row order differed across executions)");
      }
    }

    const verdict = problems.length === 0 ? "PASS" : "FAIL";
    if (problems.length > 0) failures++;
    console.log(
      `${q.id}  status=${status}  rowCount=${rowCount}  mode=${q.mode}  ${verdict}` +
        (problems.length ? `  -> ${problems.join("; ")}` : ""),
    );
  }

  console.log(`\n${ALL_QUESTIONS.length - failures}/${ALL_QUESTIONS.length} goldens passed`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error("verify-goldens crashed:", err);
  process.exit(1);
});
