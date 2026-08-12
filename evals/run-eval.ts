// NL→SQL eval runner CLI. Run from repo root:
//   npx tsx evals/run-eval.ts --models gpt-5.6-sol --trials 3
//
// Preflights the dev server + demo DB, uploads the schema to OpenAI (temporary
// file + vector store, cleaned up on every exit path including Ctrl+C),
// verifies every golden, then sweeps models × questions × trials. Streams
// JSONL per trial and writes a self-contained HTML report at the end. No
// credentials ever reach stdout, the JSONL, or the HTML.

import { parseArgs } from "node:util";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import OpenAI from "openai";
import { EXTENDED_QUESTIONS, QUESTIONS } from "./dataset";
import type {
  DbConnectionConfig,
  EvalQuestion,
  ExecuteSuccess,
  ModelVariant,
  ResultSet,
  RunConfig,
  TokenUsage,
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
import { computeCost, formatUsd, hasAnyPricing } from "./lib/pricing";

const RESULTS_DIR = path.join(__dirname, "results");
const ENV_LOCAL_PATH = path.join(__dirname, "..", ".env.local");
const SEED_SQL_PATH = path.join(__dirname, "..", "scripts", "demo-database.sql");

// ── Teardown ────────────────────────────────────────────────────────────────
// Everything this run must tear down, tracked at module scope so the normal
// finally, a crash, and a Ctrl+C all reach the same idempotent cleanup.

// Set when the runner itself starts the demo DB container; containers the user
// already had running are never touched.
let containerStartedByRunner: string | null = null;
// EVERY OpenAI resource this run created or adopted. Sets, not single ids: a
// --concurrency > 1 run can adopt several server-side schema re-uploads, and
// overwriting the ids would leak all but the last.
const createdFileIds = new Set<string>();
const createdVectorStoreIds = new Set<string>();
let openAiClient: OpenAI | null = null;
let cleanupPromise: Promise<void> | null = null;

/** Record an OpenAI resource the moment it exists; ids are only ever added. */
function trackResource(resource: { fileId?: string; vectorStoreId?: string }): void {
  if (resource.fileId) createdFileIds.add(resource.fileId);
  if (resource.vectorStoreId) createdVectorStoreIds.add(resource.vectorStoreId);
}

/** Synchronous half of teardown — the only kind an 'exit' handler can do. */
function stopRunnerContainer(): void {
  if (containerStartedByRunner === null) return;
  const container = containerStartedByRunner;
  containerStartedByRunner = null;
  console.log(`Stopping demo DB container "${container}" (started by this run)...`);
  const stop = spawnSync("podman", ["stop", container], { encoding: "utf8" });
  if (stop.status !== 0) {
    console.warn(`podman stop failed: ${(stop.stderr ?? "").trim() || stop.error?.message || "unknown error"}`);
  }
}

async function performCleanup(): Promise<void> {
  if (openAiClient !== null && (createdFileIds.size > 0 || createdVectorStoreIds.size > 0)) {
    console.log("Cleaning up OpenAI eval resources...");
    await cleanupEvalResources(openAiClient, [...createdFileIds], [...createdVectorStoreIds]);
  }
  stopRunnerContainer();
}

/**
 * Full teardown, run at most once. The promise is memoized rather than guarded
 * by a boolean so a second caller (a second Ctrl+C, or the finally racing a
 * signal) waits for the in-flight deletes instead of exiting through them.
 */
function cleanupRun(): Promise<void> {
  if (cleanupPromise === null) cleanupPromise = performCleanup();
  return cleanupPromise;
}

process.on("exit", stopRunnerContainer);

// Ctrl+C neither fires 'exit' handlers nor runs the async finally, so the
// signals get their own teardown and then exit with the conventional 128+signo.
for (const [signal, exitCode] of [["SIGINT", 130], ["SIGTERM", 143]] as const) {
  process.on(signal, () => {
    console.log(`\nReceived ${signal} — cleaning up before exit...`);
    void cleanupRun().finally(() => process.exit(exitCode));
  });
}

// Mirrors the openai SDK's Shared.ReasoningEffort union (gpt-5 / o-series only).
const REASONING_EFFORTS = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

/**
 * Cross models with efforts. With no --efforts the variant is the bare model
 * (no reasoning parameter sent), so labels stay comparable with older runs.
 */
function buildVariants(models: string[], efforts: string[]): ModelVariant[] {
  if (efforts.length === 0) {
    return models.map((model) => ({ model, effort: null, label: model }));
  }
  return models.flatMap((model) =>
    efforts.map((effort) => ({ model, effort, label: `${model}@${effort}` }))
  );
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseCli(): RunConfig {
  // pnpm forwards a literal "--" separator (e.g. `pnpm eval -- --models ...`);
  // drop it so parseArgs doesn't treat the remaining flags as positionals.
  const args = process.argv.slice(2).filter((a, i, arr) => !(a === "--" && arr.indexOf("--") === i));
  const { values } = parseArgs({
    args,
    options: {
      models: { type: "string", default: "gpt-5.6-sol" },
      trials: { type: "string", default: "3" },
      "base-url": { type: "string", default: "http://localhost:3000" },
      questions: { type: "string" },
      efforts: { type: "string" },
      extended: { type: "boolean", default: false },
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

  const efforts = values.efforts
    ? values.efforts.split(",").map((e) => e.trim()).filter(Boolean)
    : [];
  const unknownEfforts = efforts.filter((e) => !REASONING_EFFORTS.includes(e));
  if (unknownEfforts.length > 0) {
    throw new Error(
      `--efforts contains unsupported value(s): ${unknownEfforts.join(", ")}. ` +
        `Valid values: ${REASONING_EFFORTS.join(", ")}`
    );
  }

  return {
    models: values.models!.split(",").map((m) => m.trim()).filter(Boolean),
    efforts,
    trials: toPositiveInt(values.trials!, "trials"),
    baseUrl: values["base-url"]!,
    questionIds: values.questions
      ? values.questions.split(",").map((q) => q.trim()).filter(Boolean)
      : null,
    extended: values.extended!,
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

/** One attempt's billed generation. A retried trial has one entry per attempt. */
interface AttemptBilling {
  usage?: TokenUsage;
  costUsd: number | null;
}

/**
 * Folds every attempt of a trial into one billing figure. A retry re-bills the
 * generation, so the recorded trial must carry the sum — otherwise the report's
 * totals understate what the run actually spent. `model` is the last one served.
 */
function sumBilling(attempts: AttemptBilling[]): AttemptBilling {
  const billed = attempts.filter(
    (a): a is AttemptBilling & { usage: TokenUsage } => a.usage !== undefined
  );
  const priced = attempts.filter((a) => a.costUsd !== null);
  const usage =
    billed.length === 0
      ? undefined
      : billed.reduce<TokenUsage>(
          (acc, a) => ({
            model: a.usage.model,
            inputTokens: acc.inputTokens + a.usage.inputTokens,
            cachedInputTokens: acc.cachedInputTokens + a.usage.cachedInputTokens,
            cacheWriteTokens: acc.cacheWriteTokens + a.usage.cacheWriteTokens,
            outputTokens: acc.outputTokens + a.usage.outputTokens,
            reasoningTokens: acc.reasoningTokens + a.usage.reasoningTokens,
            totalTokens: acc.totalTokens + a.usage.totalTokens,
          }),
          {
            model: billed[0].usage.model,
            inputTokens: 0,
            cachedInputTokens: 0,
            cacheWriteTokens: 0,
            outputTokens: 0,
            reasoningTokens: 0,
            totalTokens: 0,
          }
        );
  return {
    ...(usage ? { usage } : {}),
    costUsd: priced.length === 0 ? null : priced.reduce((sum, a) => sum + (a.costUsd ?? 0), 0),
  };
}

/** Stamps the accumulated usage/cost (and retry count) onto a trial record. */
function applyBilling(result: TrialResult, attempts: AttemptBilling[], retries: number): TrialResult {
  const total = sumBilling(attempts);
  return {
    ...result,
    ...(total.usage ? { usage: total.usage } : {}),
    costUsd: total.costUsd,
    ...(retries > 0 ? { retries } : {}),
  };
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

  // Question selection. `--questions` ids always filter the COMBINED pool
  // (explicit ids are explicit intent — Q02 works without --extended);
  // otherwise the default pool is core-only unless --extended is set.
  const combinedPool: EvalQuestion[] = [...QUESTIONS, ...EXTENDED_QUESTIONS];
  let questions: EvalQuestion[] = config.extended ? combinedPool : QUESTIONS;
  if (config.questionIds !== null) {
    const known = new Set(combinedPool.map((q) => q.id));
    const unknown = config.questionIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      console.error(`Unknown question ids: ${unknown.join(", ")}`);
      process.exitCode = 1;
      return;
    }
    const wanted = new Set(config.questionIds);
    questions = combinedPool.filter((q) => wanted.has(q.id));
  }
  if (questions.length === 0) {
    console.error("No questions selected.");
    process.exitCode = 1;
    return;
  }

  const variants = buildVariants(config.models, config.efforts);
  if (config.efforts.length > 0) {
    console.log(
      `Sweeping ${variants.length} variant(s): ${variants.map((v) => v.label).join(", ")}`
    );
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
        containerStartedByRunner = container; // stopped again during teardown
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

  const client = new OpenAI({ apiKey });
  openAiClient = client;
  let vectorStoreId = "";

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

  /**
   * Adopt a re-uploaded vector store for subsequent calls. The new ids are
   * ADDED to the teardown set, never swapped in: several concurrent generate
   * calls can each trigger a server-side re-upload, so every pair this run ever
   * touched — including the original — has to be deleted at the end.
   */
  const adoptReupload = (body: { newFileId?: string; newVectorStoreId?: string }): void => {
    if (body.newVectorStoreId) {
      console.warn(`Schema was re-uploaded by the server; adopting new vector store.`);
      vectorStoreId = body.newVectorStoreId;
      trackResource({ fileId: body.newFileId, vectorStoreId: body.newVectorStoreId });
    }
  };

  try {
    // 4. Upload schema to OpenAI. Both ids are tracked the moment they exist,
    // so an ingestion failure or a Ctrl+C mid-wait still tears them down.
    console.log("Uploading schema to OpenAI...");
    const uploaded = await uploadSchemaForEval(client, schema, trackResource);
    vectorStoreId = uploaded.vectorStoreId;

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

    // 6. Sweep (variants sequential; question-trials pooled within a variant).
    const runTrial = async (
      v: ModelVariant,
      q: EvalQuestion,
      trial: number,
      billing: AttemptBilling[]
    ): Promise<TrialResult> => {
      const gen = await generateSql(baseUrl, {
        query: q.question,
        vectorStoreId,
        schemaData: schema,
        model: v.model,
        effort: v.effort,
      });
      adoptReupload(gen.body);
      // Cost is attributed even to failed generations — a wrong answer still
      // bills, and error responses carry `usage` when the call was billed.
      const cost = computeCost(gen.body.usage, v.model);
      // Pushed before anything else can throw, so a later failure (e.g. an
      // execute timeout) cannot discard this attempt's spend.
      billing.push({
        ...(gen.body.usage ? { usage: gen.body.usage } : {}),
        costUsd: cost.priced ? cost.usd : null,
      });

      const result: TrialResult = {
        runId,
        model: v.label,
        baseModel: v.model,
        ...(v.effort ? { effort: v.effort } : {}),
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
        ...(gen.body.usage ? { usage: gen.body.usage } : {}),
        costUsd: cost.priced ? cost.usd : null,
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
    // Every attempt's usage is accumulated, so a discarded attempt still counts
    // toward the run's reported spend.
    const runTrialSafe = async (v: ModelVariant, q: EvalQuestion, trial: number): Promise<TrialResult> => {
      const billing: AttemptBilling[] = [];
      let lastError: unknown;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = await runTrial(v, q, trial, billing);
          return applyBilling(result, billing, attempt - 1);
        } catch (err) {
          lastError = err;
          console.warn(`[${v.label}] ${q.id} trial ${trial}: attempt ${attempt} threw (${(err as Error).message}); ${attempt === 1 ? "retrying" : "recording as failure"}`);
        }
      }
      return applyBilling(
        {
          runId,
          model: v.label,
          baseModel: v.model,
          ...(v.effort ? { effort: v.effort } : {}),
          questionId: q.id,
          trial,
          question: q.question,
          tags: q.tags,
          mode: q.mode,
          generatedSql: null,
          confidence: null,
          warnings: [],
          // Null, never 0: a fabricated zero would drag the model's latency
          // stats down and make a flaky model look faster.
          generateMs: null,
          executeMs: null,
          rowCount: null,
          costUsd: null,
          pass: false,
          failureClass: "generation-error",
          failureDetail: `harness request failed after retry: ${(lastError as Error)?.message ?? String(lastError)}`,
          timestamp: new Date().toISOString(),
        },
        billing,
        1
      );
    };

    const makeTask = (v: ModelVariant, q: EvalQuestion, trial: number) => async (): Promise<TrialResult> => {
      const t = await runTrialSafe(v, q, trial);
      record(t);
      const ms = (t.generateMs ?? 0) + (t.executeMs ?? 0);
      const status = t.pass ? "PASS" : `FAIL (${t.failureClass})`;
      console.log(`[${v.label}] ${t.questionId} trial ${trial}/${config.trials}: ${status} (${ms}ms)`);
      return t;
    };

    for (const variant of variants) {
      const model = variant.label;
      console.log(`\n=== Model: ${model} (${questions.length} questions × ${config.trials} trials) ===`);
      const modelTrials: TrialResult[] = [];

      // Fail-fast probe: run the first question's trials first.
      const firstQ = questions[0];
      const firstTasks = Array.from({ length: config.trials }, (_, i) => makeTask(variant, firstQ, i + 1));
      const firstResults = await runPool(firstTasks, config.concurrency);
      modelTrials.push(...firstResults);
      if (firstResults.every((t) => t.failureClass === "generation-mock-fallback")) {
        // The route converts OpenAI errors into a 200 mock, so an unknown model
        // name AND an unsupported model/effort pairing both land here.
        console.error(
          `[${model}] all ${firstQ.id} trials hit the mock fallback — skipping. Likely causes: ` +
            `unknown model name` +
            (variant.effort
              ? `, or model "${variant.model}" does not support reasoning effort "${variant.effort}" ` +
                `(the reasoning parameter is gpt-5 / o-series only, and not every model supports every value)`
              : "") +
            `. Check the dev server console for the underlying OpenAI error.`
        );
        continue;
      }

      const rest: Array<() => Promise<TrialResult>> = [];
      for (const q of questions.slice(1)) {
        for (let trial = 1; trial <= config.trials; trial++) {
          rest.push(makeTask(variant, q, trial));
        }
      }
      modelTrials.push(...(await runPool(rest, config.concurrency)));

      const passed = modelTrials.filter((t) => t.pass).length;
      const rate = ((passed / modelTrials.length) * 100).toFixed(1);
      console.log(`[${model}] summary: ${passed}/${modelTrials.length} passed (${rate}%)`);
    }

    // 7. Report. The report groups by TrialResult.model, so it must see the
    // variant labels (e.g. "gpt-5.6-sol@low"), not the bare model names.
    const html = renderHtmlReport({
      runId,
      timestamp,
      config: { ...config, models: variants.map((v) => v.label) },
      questions,
      trials,
    });
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(htmlPath, html);

    console.log("\n=== Final per-model results ===");
    if (!hasAnyPricing()) {
      console.log('(no rates configured in evals/pricing.json — cost shown as "—")');
    }
    console.log(
      "Model".padEnd(28) + "Pass rate".padEnd(20) + "Median gen ms".padEnd(16) + "Total cost"
    );
    for (const model of variants.map((v) => v.label)) {
      const mt = trials.filter((t) => t.model === model);
      const passed = mt.filter((t) => t.pass).length;
      const rate = mt.length > 0 ? `${passed}/${mt.length} (${((passed / mt.length) * 100).toFixed(1)}%)` : "— (no trials)";
      const passingGen = mt
        .filter((t) => t.pass && t.generateMs !== null)
        .map((t) => t.generateMs as number)
        .sort((a, b) => a - b);
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
      const priced = mt.filter((t) => typeof t.costUsd === "number");
      const totalCost =
        priced.length === 0
          ? "—"
          : formatUsd(priced.reduce((sum, t) => sum + (t.costUsd ?? 0), 0)) +
            (priced.length < mt.length ? ` (${priced.length}/${mt.length} priced)` : "");
      console.log(model.padEnd(28) + rate.padEnd(20) + medianGen.padEnd(16) + totalCost);
    }
    console.log(`\nJSONL:  ${path.resolve(jsonlPath)}`);
    console.log(`Report: ${path.resolve(htmlPath)}`);
  } finally {
    await cleanupRun();
  }
}

main().catch((err) => {
  console.error("run-eval crashed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
