// NL→SQL eval runner CLI. Run from repo root:
//   npx tsx evals/run-eval.ts --models gpt-5.4 --trials 3
//
// Preflights the dev server + demo DB, uploads the schema to OpenAI (temporary
// file + vector store, always cleaned up), verifies every golden, then sweeps
// models × questions × trials. Streams JSONL per trial and writes a
// self-contained HTML report at the end. No credentials ever reach stdout,
// the JSONL, or the HTML.

import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import OpenAI from "openai";
import { QUESTIONS } from "./dataset";
import type {
  DbConnectionConfig,
  EvalQuestion,
  ExecuteSuccess,
  ResultSet,
  RunConfig,
  TrialResult,
} from "./types";
import {
  checkServerUp,
  executeSql,
  generateSql,
  introspectSchema,
  type ExecuteErrorBody,
} from "./lib/api-client";
import { classifyExecution, classifyGeneration } from "./lib/classify";
import { compareResults } from "./lib/compare";
import { renderHtmlReport } from "./lib/report";
import { cleanupEvalResources, uploadSchemaForEval } from "./lib/vector-store";

const RESULTS_DIR = path.join(__dirname, "results");
const ENV_LOCAL_PATH = path.join(__dirname, "..", ".env.local");
const SEED_SQL_PATH = path.join(__dirname, "..", "scripts", "demo-database.sql");

// Set when the runner itself starts the demo DB container; the exit handler
// below stops it again so every exit path (including crashes) cleans up.
// Containers the user already had running are never touched.
let containerStartedByRunner: string | null = null;
process.on("exit", () => {
  if (containerStartedByRunner !== null) {
    console.log(`Stopping demo DB container "${containerStartedByRunner}" (started by this run)...`);
    const stop = spawnSync("podman", ["stop", containerStartedByRunner], { encoding: "utf8" });
    if (stop.status !== 0) {
      console.warn(`podman stop failed: ${(stop.stderr ?? "").trim() || stop.error?.message || "unknown error"}`);
    }
  }
});

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseCli(): RunConfig {
  // pnpm forwards a literal "--" separator (e.g. `pnpm eval -- --models ...`);
  // drop it so parseArgs doesn't treat the remaining flags as positionals.
  const args = process.argv.slice(2).filter((a, i, arr) => !(a === "--" && arr.indexOf("--") === i));
  const { values } = parseArgs({
    args,
    options: {
      models: { type: "string", default: "gpt-5.4" },
      trials: { type: "string", default: "3" },
      "base-url": { type: "string", default: "http://localhost:3000" },
      questions: { type: "string" },
      concurrency: { type: "string", default: "1" },
      "db-host": { type: "string", default: "localhost" },
      "db-port": { type: "string", default: "5433" },
      "db-user": { type: "string", default: "demo" },
      "db-password": { type: "string", default: "demo" },
      "db-name": { type: "string", default: "cloudmetrics" },
      "db-container": { type: "string", default: "dataquery-demo-db" },
    },
    strict: true,
  });

  const toPositiveInt = (raw: string, flag: string): number => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`--${flag} must be a positive integer, got "${raw}"`);
    }
    return n;
  };

  return {
    models: values.models!.split(",").map((m) => m.trim()).filter(Boolean),
    trials: toPositiveInt(values.trials!, "trials"),
    baseUrl: values["base-url"]!,
    questionIds: values.questions
      ? values.questions.split(",").map((q) => q.trim()).filter(Boolean)
      : null,
    concurrency: toPositiveInt(values.concurrency!, "concurrency"),
    db: {
      type: "postgresql",
      host: values["db-host"]!,
      port: toPositiveInt(values["db-port"]!, "db-port"),
      database: values["db-name"]!,
      username: values["db-user"]!,
      password: values["db-password"]!,
    },
    dbContainer: values["db-container"]!.trim() || null,
  };
}

// ── Demo DB container management ────────────────────────────────────────────

function startContainer(name: string): boolean {
  const res = spawnSync("podman", ["start", name], { encoding: "utf8" });
  if (res.status !== 0) {
    console.warn(`podman start ${name} failed: ${(res.stderr ?? "").trim() || res.error?.message || "unknown error"}`);
    return false;
  }
  return true;
}

/** Pipe scripts/demo-database.sql into psql inside the container (drops + recreates + reseeds). */
function reseedDemoDb(container: string, db: DbConnectionConfig): boolean {
  console.log(`Reseeding demo DB from scripts/demo-database.sql (container "${container}")...`);
  const seed = fs.readFileSync(SEED_SQL_PATH, "utf8");
  const res = spawnSync(
    "podman",
    ["exec", "-i", container, "psql", "-U", db.username, "-d", db.database, "-q", "-v", "ON_ERROR_STOP=1"],
    { input: seed, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  if (res.status !== 0) {
    console.error(`Reseed failed: ${(res.stderr ?? "").trim().slice(-500) || res.error?.message || "unknown error"}`);
    return false;
  }
  console.log("Reseed complete.");
  return true;
}

/** True when the seed's time-anchored data has gone stale (or is missing entirely). */
async function demoDataIsStale(baseUrl: string, db: DbConnectionConfig): Promise<boolean> {
  const check = await executeSql(
    baseUrl,
    "SELECT COUNT(*) FROM usage_events WHERE created_at > NOW() - INTERVAL '7 days'",
    db
  );
  if (check.status !== 200) return true; // e.g. tables missing on a blank DB
  const body = check.body as ExecuteSuccess;
  return body.rows.length === 0 || body.rows[0][0] === "0";
}

/** OPENAI_API_KEY from env, else a minimal line-parse of .env.local. Never logged. */
function resolveOpenAiKey(): string | null {
  const fromEnv = process.env.OPENAI_API_KEY;
  if (fromEnv && fromEnv.trim() !== "") return fromEnv.trim();
  try {
    const content = fs.readFileSync(ENV_LOCAL_PATH, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = /^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
      if (match) {
        return match[1].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // fall through
  }
  return null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function coerceWarnings(warnings: unknown[] | undefined): string[] {
  if (!Array.isArray(warnings)) return [];
  return warnings.map((w) => (typeof w === "string" ? w : String(w ?? "")));
}

/** Tiny promise pool: `width` workers pulling tasks off a shared index. */
async function runPool<T>(tasks: Array<() => Promise<T>>, width: number): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(width, tasks.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = parseCli();
  const { baseUrl, db } = config;

  // Question selection.
  let questions: EvalQuestion[] = QUESTIONS;
  if (config.questionIds !== null) {
    const known = new Set(QUESTIONS.map((q) => q.id));
    const unknown = config.questionIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      console.error(`Unknown question ids: ${unknown.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    const wanted = new Set(config.questionIds);
    questions = QUESTIONS.filter((q) => wanted.has(q.id));
  }
  if (questions.length === 0) {
    console.error("No questions selected.");
    process.exitCode = 1;
    return;
  }

  const apiKey = resolveOpenAiKey();
  if (apiKey === null) {
    console.error(
      "OPENAI_API_KEY not found in the environment or .env.local — it is required for the schema upload."
    );
    process.exitCode = 1;
    return;
  }

  // 1. Preflight.
  if (!(await checkServerUp(baseUrl))) {
    console.error(`Dev server is not responding at ${baseUrl} — start it with: pnpm dev`);
    process.exitCode = 1;
    return;
  }
  const containerManaged =
    config.dbContainer != null && (db.host === "localhost" || db.host === "127.0.0.1");

  let probe = await executeSql(baseUrl, "SELECT 1", db);
  if (probe.status !== 200 && containerManaged) {
    const container = config.dbContainer!;
    console.log(`Demo DB not reachable — attempting "podman start ${container}"...`);
    if (startContainer(container)) {
      // Postgres needs a moment to accept connections after container start.
      for (let attempt = 0; attempt < 15 && probe.status !== 200; attempt++) {
        await new Promise((r) => setTimeout(r, 2000));
        probe = await executeSql(baseUrl, "SELECT 1", db);
      }
      if (probe.status === 200) {
        containerStartedByRunner = container; // stopped again by the exit handler
        console.log(`Container "${container}" started; it will be stopped when the run finishes.`);
        if (!reseedDemoDb(container, db)) {
          process.exitCode = 1;
          return;
        }
      }
    }
  }
  if (probe.status !== 200) {
    const err = (probe.body as ExecuteErrorBody).error ?? "unknown error";
    console.error(
      `Demo database probe failed (HTTP ${probe.status}: ${err}).\n` +
        `Expected PostgreSQL at ${db.host}:${db.port}/${db.database}. Start/seed it with:\n` +
        `  podman run -d --name ${config.dbContainer ?? "dataquery-demo-db"} -e POSTGRES_USER=demo -e POSTGRES_PASSWORD=demo -e POSTGRES_DB=cloudmetrics -p ${db.port}:5432 postgres:15-alpine\n` +
        `  cat scripts/demo-database.sql | podman exec -i ${config.dbContainer ?? "dataquery-demo-db"} psql -U demo -d cloudmetrics`
    );
    process.exitCode = 1;
    return;
  }

  // The seed is time-anchored (last-90-days events): stale or blank data makes
  // date-relative goldens return 0 rows and abort the golden pass, so reseed
  // proactively whenever the freshness probe fails.
  if (containerStartedByRunner === null && (await demoDataIsStale(baseUrl, db))) {
    if (containerManaged) {
      console.log("Demo data is stale or missing (no usage_events in the last 7 days).");
      if (!reseedDemoDb(config.dbContainer!, db)) {
        process.exitCode = 1;
        return;
      }
    } else {
      console.warn(
        "Demo data looks stale (no usage_events in the last 7 days) and container management is disabled — date-relative goldens will likely fail."
      );
    }
  }
  console.log(`Preflight OK: server up at ${baseUrl}, demo DB reachable at ${db.host}:${db.port}/${db.database}`);

  // 3. Introspect (retry once — transient fetch failures happen right after
  // the dev server recompiles or the DB container comes up).
  console.log("Introspecting schema...");
  let schema: unknown;
  for (let attempt = 1; ; attempt++) {
    try {
      schema = await introspectSchema(baseUrl, db);
      break;
    } catch (err) {
      if (attempt >= 3) throw err;
      console.warn(`Introspection attempt ${attempt} failed (${(err as Error).message}); retrying in 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // 4. Upload schema to OpenAI (cleaned up in the finally below, always).
  const client = new OpenAI({ apiKey });
  const uploaded = await uploadSchemaForEval(client, schema);
  let vectorStoreId = uploaded.vectorStoreId;
  let cleanupFileId = uploaded.fileId;
  let cleanupVectorStoreId = uploaded.vectorStoreId;

  const timestamp = new Date().toISOString();
  const runId = `run-${timestamp.replace(/[:.]/g, "-")}`;
  const jsonlPath = path.join(RESULTS_DIR, `${runId}.jsonl`);
  const htmlPath = path.join(RESULTS_DIR, `${runId}.html`);
  const trials: TrialResult[] = [];
  let resultsDirReady = false;

  const record = (t: TrialResult): void => {
    trials.push(t);
    if (!resultsDirReady) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
      resultsDirReady = true;
    }
    fs.appendFileSync(jsonlPath, JSON.stringify(t) + "\n");
  };

  /** Adopt a re-uploaded vector store for subsequent calls + cleanup. */
  const adoptReupload = (body: { newFileId?: string; newVectorStoreId?: string }): void => {
    if (body.newVectorStoreId) {
      console.warn(`Schema was re-uploaded by the server; adopting new vector store.`);
      vectorStoreId = body.newVectorStoreId;
      cleanupVectorStoreId = body.newVectorStoreId;
      if (body.newFileId) cleanupFileId = body.newFileId;
    }
  };

  try {
    // 2. Model-override canary (needs the vector store, hence after upload).
    console.log("Checking server model override (canary)...");
    const canary = await generateSql(baseUrl, {
      query: "How many organizations are there?",
      vectorStoreId,
      schemaData: schema,
      model: "eval-canary-nonexistent",
    });
    adoptReupload(canary.body);
    const canaryClass = classifyGeneration(canary.status, canary.body);
    if (canaryClass !== "generation-mock-fallback" && canaryClass !== "generation-error") {
      console.error(
        "EVAL_ALLOW_MODEL_OVERRIDE not active on the server — ensure it is 'true' in .env.local and restart the dev server."
      );
      process.exitCode = 1;
      return;
    }

    // 5. Golden pass.
    console.log(`Verifying ${questions.length} goldens...`);
    const goldenResults = new Map<string, ResultSet>();
    const goldenFailures: string[] = [];
    for (const q of questions) {
      const res = await executeSql(baseUrl, q.goldenSql, db);
      const body = res.body as ExecuteSuccess & ExecuteErrorBody;
      if (res.status !== 200) {
        goldenFailures.push(`${q.id}: HTTP ${res.status} (${body.error ?? "unknown error"})`);
      } else if (body.rowCount === 0) {
        goldenFailures.push(`${q.id}: golden returned 0 rows`);
      } else {
        goldenResults.set(q.id, { columns: body.columns, rows: body.rows });
      }
    }
    if (goldenFailures.length > 0) {
      console.error(`Golden verification failed for ${goldenFailures.length} question(s):`);
      for (const f of goldenFailures) console.error(`  ${f}`);
      process.exitCode = 1;
      return;
    }
    console.log("All goldens verified.");

    // 6. Sweep (models sequential; question-trials pooled within a model).
    const runTrial = async (model: string, q: EvalQuestion, trial: number): Promise<TrialResult> => {
      const gen = await generateSql(baseUrl, {
        query: q.question,
        vectorStoreId,
        schemaData: schema,
        model,
      });
      adoptReupload(gen.body);

      const result: TrialResult = {
        runId,
        model,
        questionId: q.id,
        trial,
        question: q.question,
        tags: q.tags,
        mode: q.mode,
        generatedSql: typeof gen.body.sql === "string" ? gen.body.sql : null,
        confidence: typeof gen.body.confidence === "number" ? gen.body.confidence : null,
        warnings: coerceWarnings(gen.body.warnings),
        generateMs: gen.ms,
        executeMs: null,
        rowCount: null,
        pass: false,
        failureClass: null,
        failureDetail: null,
        timestamp: new Date().toISOString(),
      };

      const genClass = classifyGeneration(gen.status, gen.body);
      if (genClass !== null) {
        result.failureClass = genClass;
        result.failureDetail =
          gen.body.error ?? (result.warnings.length > 0 ? result.warnings.join(" | ") : null);
        return result;
      }

      const exec = await executeSql(baseUrl, gen.body.sql as string, db);
      result.executeMs = exec.ms;
      const execBody = exec.body as ExecuteSuccess & ExecuteErrorBody;
      if (exec.status === 200 && typeof execBody.rowCount === "number") {
        result.rowCount = execBody.rowCount;
      }
      const execClass = classifyExecution(exec.status, execBody);
      if (execClass !== null) {
        result.failureClass = execClass;
        result.failureDetail = execBody.error ?? null;
        return result;
      }

      // Volatile goldens are NOW()-relative: re-execute right before comparing.
      let golden = goldenResults.get(q.id)!;
      if (q.volatile) {
        const fresh = await executeSql(baseUrl, q.goldenSql, db);
        const freshBody = fresh.body as ExecuteSuccess & ExecuteErrorBody;
        if (fresh.status !== 200 || freshBody.rowCount === 0) {
          result.failureClass = "result-mismatch";
          result.failureDetail = `volatile golden re-execution failed (HTTP ${fresh.status}: ${freshBody.error ?? "0 rows"})`;
          return result;
        }
        golden = { columns: freshBody.columns, rows: freshBody.rows };
      }

      const outcome = compareResults(golden, { columns: execBody.columns, rows: execBody.rows }, q.mode);
      result.pass = outcome.match;
      if (!outcome.match) {
        result.failureClass = "result-mismatch";
        result.failureDetail = outcome.detail;
      }
      return result;
    };

    // A thrown fetch error (e.g. AbortSignal timeout) must fail the TRIAL, not
    // the run: retry once for transient network hiccups, then record a failure.
    const runTrialSafe = async (model: string, q: EvalQuestion, trial: number): Promise<TrialResult> => {
      let lastError: unknown;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          return await runTrial(model, q, trial);
        } catch (err) {
          lastError = err;
          console.warn(`[${model}] ${q.id} trial ${trial}: attempt ${attempt} threw (${(err as Error).message}); ${attempt === 1 ? "retrying" : "recording as failure"}`);
        }
      }
      return {
        runId,
        model,
        questionId: q.id,
        trial,
        question: q.question,
        tags: q.tags,
        mode: q.mode,
        generatedSql: null,
        confidence: null,
        warnings: [],
        generateMs: 0,
        executeMs: null,
        rowCount: null,
        pass: false,
        failureClass: "generation-error",
        failureDetail: `harness request failed after retry: ${(lastError as Error)?.message ?? String(lastError)}`,
        timestamp: new Date().toISOString(),
      };
    };

    const makeTask = (model: string, q: EvalQuestion, trial: number) => async (): Promise<TrialResult> => {
      const t = await runTrialSafe(model, q, trial);
      record(t);
      const ms = t.generateMs + (t.executeMs ?? 0);
      const status = t.pass ? "PASS" : `FAIL (${t.failureClass})`;
      console.log(`[${model}] ${t.questionId} trial ${trial}/${config.trials}: ${status} (${ms}ms)`);
      return t;
    };

    for (const model of config.models) {
      console.log(`\n=== Model: ${model} (${questions.length} questions × ${config.trials} trials) ===`);
      const modelTrials: TrialResult[] = [];

      // Fail-fast probe: run the first question's trials first.
      const firstQ = questions[0];
      const firstTasks = Array.from({ length: config.trials }, (_, i) => makeTask(model, firstQ, i + 1));
      const firstResults = await runPool(firstTasks, config.concurrency);
      modelTrials.push(...firstResults);
      if (firstResults.every((t) => t.failureClass === "generation-mock-fallback")) {
        console.error(`[${model}] all ${firstQ.id} trials hit the mock fallback — model likely invalid — skipping`);
        continue;
      }

      const rest: Array<() => Promise<TrialResult>> = [];
      for (const q of questions.slice(1)) {
        for (let trial = 1; trial <= config.trials; trial++) {
          rest.push(makeTask(model, q, trial));
        }
      }
      modelTrials.push(...(await runPool(rest, config.concurrency)));

      const passed = modelTrials.filter((t) => t.pass).length;
      const rate = ((passed / modelTrials.length) * 100).toFixed(1);
      console.log(`[${model}] summary: ${passed}/${modelTrials.length} passed (${rate}%)`);
    }

    // 7. Report.
    const html = renderHtmlReport({ runId, timestamp, config, questions, trials });
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(htmlPath, html);

    console.log("\n=== Final per-model pass rates ===");
    console.log("Model".padEnd(28) + "Pass rate".padEnd(20) + "Median gen ms (passing)");
    for (const model of config.models) {
      const mt = trials.filter((t) => t.model === model);
      const passed = mt.filter((t) => t.pass).length;
      const rate = mt.length > 0 ? `${passed}/${mt.length} (${((passed / mt.length) * 100).toFixed(1)}%)` : "— (no trials)";
      const passingGen = mt.filter((t) => t.pass).map((t) => t.generateMs).sort((a, b) => a - b);
      const mid = Math.floor(passingGen.length / 2);
      const medianGen =
        passingGen.length === 0
          ? "—"
          : String(
              Math.round(
                passingGen.length % 2 === 1
                  ? passingGen[mid]
                  : (passingGen[mid - 1] + passingGen[mid]) / 2
              )
            );
      console.log(model.padEnd(28) + rate.padEnd(20) + medianGen);
    }
    console.log(`\nJSONL:  ${path.resolve(jsonlPath)}`);
    console.log(`Report: ${path.resolve(htmlPath)}`);
  } finally {
    console.log("Cleaning up OpenAI eval resources...");
    await cleanupEvalResources(client, cleanupFileId, cleanupVectorStoreId);
  }
}

main().catch((err) => {
  console.error("run-eval crashed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
