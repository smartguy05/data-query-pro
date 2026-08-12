# Completed Tasks

> Recent (current branch) work is detailed below. Older work is collapsed under
> **Historical (summarized)** — for full prose, see git history. Durable gotchas live in
> [docs/reference/lessons-learned.md](../docs/reference/lessons-learned.md).

## PR #23 review findings fixed (2026-08-12, branch llm-evals)
15 verified code-review findings fixed via an Opus workflow (5 fixers on disjoint file sets → 5 adversarial reviewers + tsc/lint/test gate → repair round), then a doc-sync pass and live verification.
- **compare.ts rewritten**: unordered mode now honors the 0.01 tolerance via bipartite matching (Kuhn) over `cellsEqual` — tolerant equality is non-transitive so it can never be a sort/hash key. Removed the raw NUL/SOH separator bytes that made git treat the file as binary. Selfcheck ported to `tests/unit/compare.test.ts` (25 tests), `compare.selfcheck.ts` deleted.
- **Failure classification**: execute-route 400s now carry a stable `errorCode` (`SQL_VALIDATION_REJECTED` vs `DB_USER_ERROR`/`DB_ERROR`, additive); hallucinated-column errors no longer misfile as validation-rejection.
- **Generate route**: invalid model override → HTTP 400 (no silent fallback to `OPENAI_MODEL`); eval-override requests take effort from the body ONLY (env not consulted — bare variants measure provider default); `usage` now also returned on the non-completed 500.
- **Harness**: SIGINT/SIGTERM cleanup (memoized promise, exit 130/143); ingestion-failure and concurrent-reupload leaks fixed (resource-id Sets, `cleanupEvalResources` takes lists, 404 = already cleaned); `generateMs: null` (not 0) for harness failures and excluded from latency stats; retry billing summed into the trial (`retries` field); `limitApplied` type → number.
- **Pricing**: fallback restricted to dated-snapshot suffixes — `gpt-5.4-mini` no longer inherits `gpt-5.4` rates. New tests: `tests/unit/{classify,pricing}.test.ts` (17 tests).
- **Env/config**: `.env.example` model `gpt-5.6-high` (bogus) → `gpt-5.6-sol`, effort default now empty. `.env.production` KEPT `OPENAI_REASONING_EFFORT=high` — repair agent preserved commit 0d2e951's intent; open question for the user.
- Docs synced: CLAUDE.md, docs/api/query-endpoints + overview, docs/guides/openai-integration, evals/README, pricing.json `_comment`, evals/types + api-client comments (`ExecuteErrorBody.errorCode` declared).
- Gate: tsc 0, lint 0, 212/212 vitest. Live-verified (dev server + `dataquery-demo-db`): errorCode discrimination on both 400 kinds, 400 on `openai/gpt-5.4` override, canary → 200 mock fallback, pages 200.
- **User decisions (same day)**: canonical `OPENAI_MODEL` default is now **`gpt-5.6-sol`** everywhere (docker-compose, CLAUDE.md, README, docs/README, getting-started, deployment, openai-integration, testing/README, evals/README + `--models` CLI default in run-eval.ts). `.env.production` KEEPS `OPENAI_REASONING_EFFORT=high` (deliberate). `.env.local` duplicate effort line removed — `high` is now effective locally. Committed + pushed to PR #23.

## Per-model cost reporting in evals (2026-08-10, branch llm-evals)
- **Production**: `/api/query/generate` now returns `usage` (model actually served + inputTokens/cachedInputTokens/cacheWriteTokens/outputTokens/reasoningTokens/totalTokens) on all 4 success paths. Previously ALL 6 `responses.create` call sites discarded `response.usage`. Additive field, returned to every caller (chosen over eval-only gating so the query audit log can record tokens later).
- **Harness**: `evals/pricing.json` (USD per 1M tokens, committed with **null rates — fill in before cost appears**), `evals/lib/pricing.ts` (`computeCost`/`formatUsd`/`hasAnyPricing`). Cost added to the final console table + HTML ranking and summary; **does NOT affect ranking order** (still pass count → median latency, per user's rule).
- **Token semantics (openai@7.4.0, verified)**: `reasoning_tokens` ⊂ `output_tokens`; `cached_tokens` and `cache_write_tokens` ⊂ `input_tokens`. Breakdowns, never additive. Fresh input = input − cached − cacheWrite.
- **Price lookup** keys off the model OpenAI actually served — real responses report a dated snapshot (`gpt-5.4-2026-03-05`), NOT the requested alias — then falls back to longest prefix key (tightened 2026-08-12: dated-snapshot suffix only). Unknown model ⇒ `priced:false` ⇒ renders "—" rather than a silent $0.
- **KEY FINDING**: a generation is ~18,364 input vs ~139 output tokens (**~130:1**) because the schema context dominates. Cost is therefore almost entirely input-driven — reasoning effort is a *latency* lever, not a cost lever. Also `cachedInputTokens` came back **0**, so no prompt caching is occurring across trials despite the identical large system prompt.
- Verified offline (no API spend): cost math matches hand computation exactly, dated-snapshot prefix match resolves, unknown model unpriced, cached discount applies; report rendering verified with synthetic priced/unpriced/partially-priced models.

## Reasoning effort support + eval sweep (2026-08-07, branch llm-evals)
- **Why**: eval found gpt-5.6-sol matched gpt-5.4 on accuracy but was 2x SLOWER (median 10.5s vs 5.2s, slower on 16/16 questions; terra ran between them and was fast, ruling out drift). Sol emits *shorter* SQL yet takes longer → time goes to internal reasoning, so effort is the lever.
- **Production** (`app/api/query/generate/route.ts`): `OPENAI_REASONING_EFFORT` env var + optional `effort` request param (gated by the same `EVAL_ALLOW_MODEL_OVERRIDE` flag as `model`). `asReasoningEffort()` narrows to the SDK's `Shared.ReasoningEffort` union (none|minimal|low|medium|high|xhigh|max); the `reasoning` key is **spread in only when set** so default behavior is byte-identical. Config added to `.env.example`, `.env.local` (empty), `docker-compose.yml`. Applies to the generate route ONLY — the other 6 OPENAI_MODEL routes untouched.
- **Eval** (`evals/`): `--efforts` flag crosses models × efforts into `ModelVariant {model, effort, label}`; label is `model@effort`. Report needed ZERO changes — it groups by `TrialResult.model`, so variant labels rank against each other automatically. TrialResult gained `baseModel`/`effort` for JSONL analysis. Fail-fast message widened to name an unsupported model/effort pairing as a likely cause (API validates, SDK doesn't).
- **SDK ground truth** (openai 7.4.0): `reasoning?: Shared.Reasoning|null` at responses.d.ts:7117, "gpt-5 and o-series models only"; `ReasoningEffort` union at shared.d.ts:195; also available but unused: `text.verbosity` (low|medium|high) and `service_tier` ('fast'/'priority' = latency knob).
- **Probe (4 calls)**: sol@low median 6291ms vs sol@high 8647ms, both 2/2 pass; Q16 7.4s vs 11.2s. Directionally confirms effort drives sol's latency (vs ~10.5s at default) but n=2 — needs a real run to be conclusive.
- Verified: tsc clean, lint clean on the route, JSONL records baseModel/effort correctly.

## Eval dataset split core/extended (2026-08-07, branch llm-evals)
- `evals/dataset.ts` restructured into `QUESTIONS` (core 16: all 8 phase4-tagged Q01/Q08/Q11/Q15/Q20/Q23/Q26/Q30 + Q05,Q06,Q13,Q16,Q18,Q27,Q28,Q31 — every mode/bucket covered) and `EXTENDED_QUESTIONS` (other 16), entries preserved verbatim. Motivation: halve default OpenAI cost (16 q × 3 trials ≈ 48 generate calls).
- `run-eval.ts`: new `--extended` boolean flag (RunConfig.extended); default pool = core, `--extended` = all 32; `--questions` ids always resolve against the combined pool. `verify-goldens.ts` always verifies the combined 32. README updated (baseline 95/96 was on the full 32-question set).
- Verified: tsc clean; verify-goldens 32/32 (container started/stopped around it; no reseed needed). Not committed.

## LLM eval harness for NL→SQL generation (2026-08-07, branch llm-evals)
- Built `evals/` — a standalone tsx CLI harness (`pnpm eval -- --models gpt-5.4,gpt-5.6-luna --trials 3`) that measures how well a model turns NL questions into SQL that executes and returns correct results, for comparing gpt-5.4 vs the 5.6 family.
- **Only production change**: `/api/query/generate` accepts an optional `model` body param, honored ONLY when `EVAL_ALLOW_MODEL_OVERRIDE=true` (env flag, off by default; `.env.example` documented). Everything else lives under `evals/`.
- Pieces: `types.ts` (contracts), `dataset.ts` (32 questions incl. all 8 from docs/testing/phase-4, each with golden SQL + comparison mode scalar/ordered/unordered/row-count/non-empty + volatile flag for NOW()-relative), `lib/api-client.ts` (HTTP wrappers), `lib/classify.ts` (failure classes incl. the route's 200-with-mock-SQL fallback), `lib/compare.ts` (column-name-agnostic result-set comparator, numeric/date tolerance, row-multiset semantics; covered by `tests/unit/compare.test.ts` — the old `compare.selfcheck.ts` was removed 2026-08-12), `lib/vector-store.ts` (schema upload WITH ingestion polling — app util has a race), `lib/report.ts` (self-contained HTML report: speed-aware model ranking [pass count desc, then median passing-trial generate latency asc], summary, confidence calibration, per-question matrix, failure appendix), `run-eval.ts` (runner: preflight, canary that detects an inactive override flag, golden pass, fail-fast on bogus model, JSONL streaming to `evals/results/`), `verify-goldens.ts`.
- Dataset adversarially reviewed: 6 defects fixed (paid-vs-all-invoice ambiguity, 'YYYY-MM' month projection the comparator could never match, rank-5 tie in top-5 → top-3, LEFT JOIN ambiguity, etc.). All 32 goldens verified live (32/32, exactly-1-row for scalars, tie-free ordered keys).
- Smoke run 3/3 pass end-to-end (schema introspect → vector store → generate → execute → compare → JSONL + HTML). Target: demo CloudMetrics Postgres container `dataquery-demo-db` on :5433 (demo/demo — NOT the compose file's demo123).
- **gpt-5.4 BASELINE (2026-08-07): 95/96 (99.0%), median generate latency 5.4s** — `evals/results/run-2026-08-07T20-38-41-622Z.{jsonl,html}`. Sole failure: Q31 ("How is the business doing?", ambiguous bucket) where the model declined to guess and asked for clarification — defensible behavior, scored as fail by the deterministic rule (same rule for all models). Two earlier runs (93.8%, 92.7%) were invalidated by dataset defects (unknowable literals, view blindness) — fixed; also hardened the runner against fetch timeouts (retry once, then fail the trial not the run).

## Default query row limit dropdown (2026-07-14, branch main)
- Query page gained a "Default row limit" dropdown (presets 25/50/100/200/500, No Limit, Custom… numeric entry) in the Query Input card's button row. New `components/default-limit-select.tsx`; type `DefaultQueryLimit = number | 'none'` + `QUERY_LIMIT` consts + `isDefaultQueryLimit` guard in `lib/constants.ts` (default 100 = historical prompt behavior).
- **Enforced in both places**: `/api/query/generate` prompt rule 4 is now computed from `defaultLimit` ('none' → no automatic limit); `/api/query/execute` injects a dialect-aware limit via new `lib/database/sql-limit.ts` (`sanitizeLimit` + `applyDefaultRowLimit`) when the SQL has no explicit LIMIT/TOP/FETCH — explicit limits always win, "No Limit" injects nothing. Response gains optional `limitApplied`; success toast mentions it.
- Injection strategy: AST-first detection (node-sql-parser, reuses exported `DIALECT_MAP`/`stripNonCode` from sql-validator), walks the `_next` UNION chain (parser hangs a trailing UNION LIMIT on the LAST node, not the root). pg/mysql/sqlite inject by string-append `LIMIT n`; sqlserver sets `stmt.top` + sqlify with re-parse guard. Fail-open on unparseable SQL (sqlserver skips entirely). Covers hand-edited SQL, report runs, history re-runs, follow-ups (all funnel through `executeTabQuery`).
- Persistence: `getDefaultQueryLimit`/`setDefaultQueryLimit` on `StorageProvider` + both impls (localStorage key `default_query_limit`; auth mode read-merge-write of the preferences JSONB since the PUT COALESCE-replaces it). Context exposes `defaultQueryLimit`/`setDefaultQueryLimit` (fire-and-forget persist).
- Tests: `tests/unit/sql-limit.test.ts` (24 cases incl. UNION/CTE/subquery/FETCH FIRST/unparseable). Full suite 162 pass, lint 0/0, build clean. Verified end-to-end (dev server + SQLite + Playwright): 14-case API matrix + UI flows (persist across reload, custom entry digit-stripping, Escape/empty revert, capped auto-execute toast).

## Copy query results to clipboard (2026-06-26, branch main)
- Added a split "Copy" control to the results toolbar in `components/query-results-display.tsx` (next to the CSV/JSON export buttons). Main button copies the current result set **with headers**; an adjacent chevron `DropdownMenu` offers "Copy with/without headers" + a TSV/CSV `DropdownMenuRadioGroup` (default TSV).
- New helpers `buildClipboardText(includeHeaders)` + `copyResults(includeHeaders)`: maps over `processedData` (respects search/filter/sort) using existing `formatCellValue` so copied cells match the displayed values (currency `$`, localized dates). Null/undefined → empty string (not "-"). CSV path quote-escapes; TSV joins on `\t`. Uses `navigator.clipboard.writeText` with a `useToast` success/failure toast.
- New state: `copyFormat` ("tsv"|"csv"), `justCopied` (1.5s Check-icon flash). Lint + `tsc --noEmit` clean.

## Documentation refresh — code-vs-docs audit (2026-06-19, branch more-improvements)
- Audited all 22 doc files (CLAUDE.md + docs/**) against current code via a fan-out workflow
  (one verify-and-edit agent per file) + a read-only cross-check pass (verdict: clean). 21 files
  updated, +726/−112; lessons-learned.md was already accurate.
- Caught docs up to recent work: /profile + /learning pages, nav restructure (3 top-level +
  Data/Query dropdowns, Admin+Profile in user menu), learn-from-queries (few-shot + corrections,
  schema-fingerprint), team-wide corrections pool (migration 006, repo, /api/data/corrections),
  read-only execution + AST sql-validator (replaced regex blocklist), query audit log (migration
  005, lib/query-log*.ts, JSONL fallback), import-reports dialog, chart customizer/visualization.
  Fixed stale counts: migrations 001-004→001-006, repositories 8→11; added new models
  (query-accuracy, query-correction) + new API routes to inventories.
- Noted (not a bug): client learning caps AI.MAX_FEW_SHOT=4 / MAX_CORRECTIONS=2 vs server
  buildLearningSections defensive slice 6/4 — client caps bound the payload, so docs cite those.
- Followed up: standardized OPENAI_MODEL canonical default to **gpt-5.4** across docs + config
  (.env.example, .env.production, docker-compose.yml `${OPENAI_MODEL:-gpt-5.4}`, README, CLAUDE.md,
  docs/README, getting-started, testing, deployment, openai-integration). Deliberately NOT changed:
  the per-route code fallback literals in route handlers (followup→gpt-5.1, suggestions/descriptions
  →gpt-5, chart→gpt-5-mini) and the `docs/api/overview.md` table that documents them — those mirror
  actual application code, which was out of the agreed "docs + config files" scope.

## Nav consolidation + Admin/Profile relocation + real Profile page (2026-06-19, branch more-improvements)
- Crowded top nav (7 flat links) reduced to 3 top-level items. New shape: **Dashboard** (standalone) + **Data ▾** (Database, Schema) + **Query ▾** (Query, History, Learning, Reports).
- Replaced flat `navigation` array with `standaloneLinks` + `navGroups` (+ `NavGroup` type) in `components/navigation.tsx`. Desktop uses Radix `DropdownMenu` (already imported for user menu); parent highlights via `isGroupActive(group)`. Added `ChevronDown` icon. Mobile keeps flat expanded list with uppercase group-label headers.
- **Admin** moved out of the top nav into the profile dropdown (between Profile and Sign out), gated on `isAdmin`. Same on mobile (in the user section).
- **Profile link was dead** — it pointed at `/admin` (Admin Panel, which redirects non-admins to `/`); there was no profile route. Built a real `app/profile/page.tsx`: account card (avatar/name/email/admin badge/groups from `useAuth`, with a "Local mode" fallback when auth disabled) + Usage stats (query accuracy %, connections, reports counts from `useDatabaseOptions`) + Admin Panel / Sign out actions. Nav "Profile" now → `/profile` (desktop + mobile; added Profile to mobile too). Guards: in auth mode redirects to `/` if not authenticated.
- Verified: `npm run lint` 0/0, `npm run build` passes (route `/profile` 4.73 kB).

## Import Reports (2026-06-19, branch more-improvements)
- Closed a gap: Reports page had **Export** (`export-reports-dialog.tsx`, emits `{version,exportDate,reports[]}`) but **no import**. The only importer was the Database page's `importData`, which rejects any file lacking `databaseConnections` AND writes straight to localStorage (broken in auth mode).
- New `components/import-reports-dialog.tsx` + "Import Reports" button on `app/reports/page.tsx`. File picker → parse (accepts `{reports}`, bare array, or `{savedReports}`) → classify each report: **duplicate** (id already in context.reports → skipped, idempotent), **auto** (original `connectionId` exists → imports there), **orphan** (connection missing → per-report connection `Select`, unassigned orphans skipped). Imports via context `saveReport` so it works in BOTH localStorage and auth modes. Strips `source`/`accessLevel`/`sharedBy*` on import. Toast summarizes imported + skipped counts.
- Decisions (user): auto-assign original connection else per-report choice; skip-by-id for duplicates.
- Verified: `pnpm lint` 0/0, `pnpm build` passes.

## Connection & Report Sharing UI (2026-06-19, branch more-improvements)
- Surfaced the already-built sharing backend in the UI (it had none). Scope: connections +
  reports. Permissions **View/Edit only** (admin dropped from UI), default view, owner can
  grant edit. Presentation: separate "Your X" / "Shared with you" sections. View-only
  recipients see Edit/Delete **shown-but-disabled** w/ tooltips. All gated on `authEnabled`.
  No new migration (tables exist in 001).
- Models: added optional `accessLevel?: "owner"|"view"|"edit"`, `sharedByEmail?`,
  `sharedByName?` to `DatabaseConnection` + `SavedReport` (`undefined` ⇒ owned).
- Repos: `getConnectionsForUser`/`getReportsForUser` tag owned rows `'owner'`, shared rows by
  `permission`, and `LEFT JOIN users` on `owner_id` for "Shared by …". `toClientConnection`/
  `toClientReport` gained an `accessLevel` 2nd arg — **callers using `.map(toClientX)` must
  wrap `.map(r => toClientX(r))`** (index leak broke the build once).
- `ShareDialog`: controlled mode (`open`/`onOpenChange`) + custom `trigger` prop; reports open
  it from a dropdown via controlled state, connections via inline trigger. Per-share permission
  `Select` (view↔edit upsert), success/error toasts (was silently swallowing).
- UI: `app/database/page.tsx` + `components/saved-reports.tsx` extracted `renderConnectionCard`/
  `renderReportCard`, partition owned/shared, two titled sections when `authEnabled &&
  shared.length>0`. Owner-only Share; `canEdit = !server && (!shared || accessLevel==='edit')`;
  delete/pin/favorite owner-only; purple "Shared by {name} · View/Edit" badge.
- Verified: `pnpm lint` 0/0, `pnpm build` passes, 138 vitest tests pass. Sharing routes/repo
  SQL NOT unit-tested (need live Postgres + auth) — verify via manual e2e in auth mode.

## Learning Feature Phase 2 — team-wide corrections sync (2026-06-18, branch more-improvements)
- Captured failed→revised corrections now shared across a team in auth mode (Phase 1 was
  device-local). Decisions: corrections only (examples/history stay device-local), team-wide
  pool keyed purely by schema fingerprint, author-or-admin edit/delete, capture-only, curation page.
- Migration `006_query_corrections.sql`: pooled by `schema_fingerprint` (NOT per-user).
  `owner_id ... ON DELETE SET NULL` (attribution only). Indexes `(fingerprint, created_at DESC)`
  + dedup unique `(fingerprint, md5(bad_sql), md5(good_sql))`.
- Repo `query-correction-repository.ts`: `getByFingerprint` (no owner filter, LEFT JOIN users),
  `createCorrection` (`INSERT ... ON CONFLICT DO NOTHING`), `update`/`delete` gated
  `WHERE id=$ AND (owner_id=$user OR $isAdmin)`.
- API `/api/data/corrections` (GET `?fingerprint=`, POST) + `[id]` (PUT, DELETE). Added 4
  methods to `StorageProvider` (corrections previously bypassed it); context exposes
  `recordQueryCorrection`/`getCorrectionsForFingerprint`/`update`/`delete` (fire-and-forget).
- Curation page `app/learning/page.tsx` (+ nav "Learning"): list/search/edit/delete for current
  connection's fingerprint; `canManage = !authEnabled || isAdmin || ownerId===user.id` (server
  enforces too). `QueryCorrection` gained `ownerId`/`ownerName`/`updatedAt`; `CORRECTIONS.MAX_POOL_FETCH=200`.
- Verified: tsc 0, lint 0/0, build passes, 138 tests (new `query-corrections-storage.test.ts`).
  Repo SQL not unit-tested (needs live DB).

## Query Safety, Auditing & Learning (2026-06-18, branch more-improvements)
- **Read-only execution**: `AdapterConnectionConfig.readOnly` flag set in `/api/query/execute`
  + `/api/schema/sample-data`. Per-dialect enforcement (PG RO tx, MySQL RO tx+ROLLBACK, SQL
  Server wrap+always-ROLLBACK, SQLite connect-time readonly). Introspection stays writable.
- **AST validator** `lib/database/sql-validator.ts` `validateReadOnlySql(sql,dbType)` replaced
  the regex blocklist — `node-sql-parser` (dep ^5.4.0), single `select` only, hybrid fallback
  to `heuristicReadOnly()` when astify throws. Removed dead `DANGEROUS_SQL_KEYWORDS`.
- **Audit log** `lib/query-log.ts` `logQuery()` (fire-and-forget): app DB `query_log`
  (migration 005, no FK) when `isAppDbEnabled()` else `logs/query-log.jsonl`. Never logs creds.
- **Learn from previous queries** (per-user few-shot + avoid-mistakes, device-local, per schema
  fingerprint): `utils/schema-fingerprint.ts`, `utils/example-relevance.ts`,
  `utils/query-corrections.ts`. Client `buildLearningContext` → `/api/query/generate`; server
  `buildLearningSections()` injects two guarded prompt sections. Constants `AI.MAX_FEW_SHOT=4`,
  `AI.MAX_CORRECTIONS=2`, `CORRECTIONS.MAX_ENTRIES=50`.
- Verified: tsc clean, lint 0/0, build passes, 123 tests at the time (new: sql-validator,
  schema-fingerprint, example-relevance, query-log-no-credentials). Not live-DB tested.
- (Full SQL-safety/learning gotchas → docs/reference/lessons-learned.md.)

## Team Collaboration (Roadmap item) — COMPLETE (2026-06-19)
- Delivered across: team-wide shared **query corrections** (Learning Phase 2, auth mode) +
  **connection/report sharing** (view/edit, owner-curated) + **admin server-connection
  assignment** to users/groups + **schema sharing** (admin uploads visible to assigned users).
  Considered complete per user decision 2026-06-19.

---

## Historical (summarized)

### Core feature set (complete)
Multi-DB (PostgreSQL/MySQL/SQL Server/SQLite via adapter pattern); NL→SQL via OpenAI Responses
API; query enhance / self-correct-revise / follow-ups; schema introspection (background + poll)
with AI table/column descriptions + change detection; column type auto-detect + manual override;
multi-tab query UI; saved reports w/ `{{param}}` params, favorites, clone, import/export;
AI metric/report suggestions; charts (bar/line/pie/area/scatter/composed) via Recharts;
dashboard widgets (pin reports as KPIs / trend charts, live execution); query accuracy stat;
chart customizer; query history (device-local); dark/light theme; server config via
`config/databases.json` + shared reports via `config/reports.json`; rate limiting + BYOK;
CSRF; error boundary; landing page; real connection testing; data export/import.

### Auth & multi-user (2026-02-05 → 06)
Optional Authentik OIDC via Auth.js v5 (JWT, no DB sessions); dual-mode storage
(localStorage / PostgreSQL); `StorageProvider` abstraction; auto-migration via
`instrumentation.ts`; AES-256-GCM credential encryption; 10 PG tables + 8 repositories;
`/api/data/*`, `/api/sharing/*`, `/api/admin/*` routes; `getAuthContext` on all routes;
credential resolution from app DB; login page; nav user menu; admin panel (server-connection
assignment); data-migration dialog; `useAuth` hook. Auth testing infra:
`docker-compose.auth-test.yml` + `scripts/setup-authentik.sh` + `docs/guides/authentication-testing.md`.
Bug fixes: migration dialog gating, pre-session API calls, getToken secret, JWT retry, JSONB
double-serialization, migration idempotency/FK guards, ContentLoadingGate, PG PK cross-product.

### Testing / tooling / docs (2026-06-18)
Vitest + Testing Library harness (`vitest.config.ts`, jsdom, `@/` alias); ESLint
(`.eslintrc.json` next/core-web-vitals). **Group C type refactor**: all `models/*.interface.ts`
→ exported modules + `import type` at ~22 sites; tsc 0 (was 85); next.config flipped to enforce
type-check + lint; build script de-fanged to plain `next build`. Guides added: performance,
deployment. Playwright E2E (docs/testing/) still NOT implemented.

### Other features (2026-03 → 2026-06)
Per-table AI descriptions + sample-data preview (`/api/schema/sample-data`); copy schema
descriptions between connections (`utils/copy-descriptions.ts` + dialog, client-only);
composed chart type; enhanced chart customizer (`components/chart-customizer.tsx`,
`SavedReport.visualization`); dashboard remove-widget control; export-reports dialog +
`config/reports.json` shared reports (read-only, "Server Config" badge); error-sanitizer
`detail` field (raw DB message for query-logic errors); doc refresh/reorg (split testing-plan
→ docs/testing/, added file-map, data-endpoints, auth-and-data-layer).
