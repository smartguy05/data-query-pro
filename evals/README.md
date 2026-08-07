# NL→SQL Eval Harness

Measures how well an OpenAI model turns natural-language questions into SQL that
executes and returns **correct** results, using the app's real `/api/query/generate`
and `/api/query/execute` routes. Built to compare `gpt-5.4` against newer models
(e.g. `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5.6-sol`).

## Prerequisites

1. **Demo database** — the CloudMetrics demo Postgres on port **5433**.
   **The runner manages this automatically** (podman container
   `dataquery-demo-db`, override with `--db-container`, `--db-container ""`
   disables management):

   - **Not running?** The runner starts the container, waits for Postgres,
     reseeds it, and **stops it again when the run finishes** (any exit path).
     A container that was already running when the run began is left running.
   - **Running but stale?** The seed is time-anchored ("last 90 days" events),
     so the runner probes freshness (any `usage_events` in the last 7 days)
     and reseeds automatically when stale — a reseed **drops and recreates**
     the demo tables.

   Only the initial creation is manual (one time, password is "demo", NOT the
   compose file's demo123):

   ```bash
   podman run -d --name dataquery-demo-db -p 5433:5432 \
     -e POSTGRES_USER=demo -e POSTGRES_PASSWORD=demo -e POSTGRES_DB=cloudmetrics \
     postgres:15-alpine
   ```

2. **`.env.local`** must contain:

   ```
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-5.4
   EVAL_ALLOW_MODEL_OVERRIDE=true    # lets the harness pick the model per request
   ```

   `DEMO_RATE_LIMIT` must be unset/empty. If you add `EVAL_ALLOW_MODEL_OVERRIDE`
   while the dev server is running, restart it — the runner's canary aborts with
   a clear message if the flag isn't active.

3. **Dev server** running: `pnpm dev` (the harness checks but does not start it).

## Running

```bash
# smoke test (3 questions × 1 trial, ~3 OpenAI calls)
pnpm eval -- --models gpt-5.4 --trials 1 --questions Q01,Q23,Q30

# single-model default run (core 16 questions × 3 trials ≈ 48 generate calls,
# roughly half the previous cost of the full set)
pnpm eval -- --models gpt-5.4 --trials 3

# full 32-question run (core + extended, ≈ 96 generate calls, ~13 min, ~$1–3)
pnpm eval -- --models gpt-5.4 --trials 3 --extended

# multi-model comparison sweep
pnpm eval -- --models gpt-5.4,gpt-5.6-luna,gpt-5.6-terra,gpt-5.6-sol --trials 3
```

The dataset is split into a **core** set of 16 questions (`QUESTIONS` — all 8
phase4-tagged questions plus at least one of every bucket/mode) and an
**extended** set of 16 (`EXTENDED_QUESTIONS` — verified goldens excluded from
the default run to halve API cost). `--extended` sweeps all 32. `--questions`
ids always resolve against the combined pool, so e.g. `--questions Q02` works
without `--extended`.

### CLI flags (all optional)

| Flag | Default | Notes |
|------|---------|-------|
| `--models` | `gpt-5.4` | comma-separated list, run sequentially |
| `--trials` | `3` | trials per question (generation is nondeterministic) |
| `--questions` | core 16 | comma-separated ids for subset/smoke runs (matched against all 32) |
| `--extended` | off | include the 16 extended questions (full 32-question run) |
| `--base-url` | `http://localhost:3000` | dev server |
| `--concurrency` | `1` | parallel trials within a model |
| `--db-host/-port/-user/-password/-name` | `localhost/5433/demo/demo/cloudmetrics` | demo DB |
| `--db-container` | `dataquery-demo-db` | podman container to auto-start/reseed/stop; `""` disables |

## What a "pass" means

A trial passes only if the generated SQL **executes without error, returns ≥ 1 row,
and its result set matches the question's authored golden SQL** (see `dataset.ts`;
comparison modes: `scalar`, `ordered`, `unordered`, `row-count`, `non-empty`).
The comparator (`lib/compare.ts`) ignores column names/aliases, tolerates numeric
formatting differences, and allows extra columns.

Failures are classified (`lib/classify.ts`): `generation-mock-fallback` (the route
swallows errors and returns HTTP 200 with mock SQL — detected explicitly),
`json-parse-fallback`, `generation-error`, `validation-rejection`, `execution-error`,
`empty-result`, `result-mismatch`.

## Output

Each run writes two files to `evals/results/` (gitignored):

- `run-<timestamp>.jsonl` — one record per trial (streamed, crash-safe)
- `run-<timestamp>.html` — self-contained report: **model ranking (pass count,
  ties broken by median generate latency of passing trials — equally accurate but
  faster ranks higher)**, per-model summary, confidence calibration, per-question
  matrix, and an appendix of every failing trial's SQL.

Baseline on record: **gpt-5.4 — 95/96 (99.0%), median generation 5.4s**
(`run-2026-08-07T20-38-41-622Z`) — measured on the **full 32-question set**
(before the core/extended split; equivalent to a `--extended` run today).

## Gotchas

- Golden and generated SQL run against the **same live DB in the same run**; seed
  data is randomized per load, so never compare across reseeds.
- On PowerShell, quote comma lists: `--questions "Q01,Q20"` (unquoted commas are
  split into separate arguments).
- A typo'd model name triggers fail-fast after the first question (the route turns
  unknown-model errors into its mock fallback; the harness detects and skips).
- Questions quote data literals verbatim (e.g. status `'in_progress'`, priority
  `'Critical'`) because the uploaded schema is structure-only: no example values,
  and **no views** (introspection reads `pg_catalog.pg_tables`). Keep that rule
  when adding questions, and verify with `npx tsx evals/verify-goldens.ts`.
