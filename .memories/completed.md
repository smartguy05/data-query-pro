# Completed Tasks

> Recent (current branch) work is detailed below. Older work is collapsed under
> **Historical (summarized)** — for full prose, see git history. Durable gotchas live in
> [docs/reference/lessons-learned.md](../docs/reference/lessons-learned.md).

## Group-based sign-in restriction — AUTH_ALLOWED_GROUPS (2026-08-12)
User-requested access gate: when set (comma-separated group names / Entra GUIDs / App Role values, same matching as AUTH_ADMIN_GROUP), only members may log in. Empty/unset = everyone (opt-in, backward compatible). Works on both providers.
- **Helpers**: `matchesAnyIdentity()` extracted from `matchesAdmin` (now a wrapper) + `isSignInAllowed()` in `lib/auth/oidc-profile.ts` — the empty-spec semantics INVERT between the two (admin: empty ⇒ nobody; gate: empty ⇒ everyone), which is why the gate is a separate function, not a flag. `getAllowedGroupsSpec()` in `lib/auth/config.ts` (no default, blank ⇒ undefined).
- **Sign-in enforcement**: new `signIn({ profile })` callback in `auth-options.ts` returns `false` ⇒ Auth.js (verified in installed `next-auth@5.0.0-beta.30` / `@auth/core`) throws `AccessDenied` and redirects to `pages.error` + `?error=AccessDenied`. `pages.error = '/auth/error'` added. Distinct warn log when denial coincides with a groups overage.
- **Existing sessions**: middleware.ts is the PRIMARY request-time check (runs before routes that treat a null auth context as local-mode pass-through) — API 401, pages redirect to `/auth/error?error=AccessDenied` (NOT /auth/login: silent SSO would loop). `getAuthContext()` also returns null on gate failure (defense in depth). `/auth/error` added to `PUBLIC_PATHS` — **mandatory or the denial redirect loops**.
- **Error page**: new `app/auth/error/page.tsx`, server component (searchParams is a Promise in Next 15), message map keyed on `?error=`, styled after the login page.
- **Overage fails closed** by design (fail-open would let any 150+-group Entra user bypass the gate); docs everywhere recommend App Role values for the gate on Entra.
- Tests: +13 in `tests/unit/oidc-profile.test.ts` (314/314 pass). Docs: `.env.example`, `azure-entra-setup.md` (new §5 incl. Entra "Assignment required?" toggle), `auth-and-data-layer.md` tables, `azure-deployment-guide.html`, CLAUDE.md.

## Query cancellation + dirty reads (2026-08-12, branch llm-evals)
Two user-requested features, plus prerequisite fixes the user explicitly approved bundling.

**Feature 1 — real database-level query cancellation.** Cancel button in the query page's action row, not an X inside Execute: that button is `disabled` while executing and a disabled button blocks pointer events on its children, so an inner X could never be clicked.
- Primitive is `AbortSignal` threaded through `executeQuery(sql, options?)` (new `ExecuteOptions` in `lib/database/types.ts`), NOT a `cancel()` method on the adapter. `lib/database/query-registry.ts` maps `queryId -> AbortController` and imports no driver — that is what makes it the one unit-testable piece. The cancel route aborts; each adapter does its own kill in an abort listener.
- Per engine: **PG** folds `pg_backend_pid()` into the existing `set_config` round trip (zero extra queries), kills via `pg_cancel_backend` on a fresh `max:1` client. Deliberately NOT postgres.js's own `query.cancel()` — `src/query.js:52-54` discards the canceller's promise via the comma operator, so a cancel-socket error becomes an unhandled rejection that by default kills the process. **MySQL** uses `client.threadId` (exposed on the promise connection) + `KILL QUERY` on a second connection; never `destroy()`, which closes the socket but leaves the query running server-side. **SQL Server** retains the `Request` (previously constructed inline and discarded) and calls `request.cancel()` — same socket, no second connection, and order-independent since mssql's default cancel just sets `canceled`, checked before execution starts. **SQLite is impossible twice over**: no `sqlite3_interrupt` binding in better-sqlite3, and execution is synchronous so the event loop is blocked and the server cannot even receive the cancel. Button hidden via `supportsQueryCancellation()`.
- Registry keys are **client-generated UUIDs** (the client needs one before the response exists), validated by `parseQueryId`, and namespaced `ownerKey:queryId` so cross-owner cancellation is structurally impossible. Collisions and a full registry **refuse** rather than overwrite/evict — the controller is the only handle to a running query, so evicting a live entry would make it unkillable. TTL 10min >> the 120s statement timeout, so a swept entry is one the DB already killed.
- **The accuracy-stat trap**: an aborted fetch lands in the existing `catch` in `app/query/page.tsx`, which called `recordQueryOutcome(false)` + a destructive toast. The `AbortError` branch `return`s before all of it (also skipping history). `executeTabQuery` had no `finally` at all — added, or the per-tab ref would leak an entry per execution.
- **Cancel POSTs before aborting**, deliberately: aborting first closes the socket, and whether the server sees the disconnect is deployment-dependent, while its `finally` may already have unregistered the query — leaving it running unattended.
- Cancellation messages are invisible to `sanitizeDbError` (PG "canceling statement due to user request", MySQL "Query execution was interrupted", mssql "Canceled." all miss every pattern incl. `/timeout/i`) so they'd become a generic 500. The route classifies from `controller.signal.aborted` and **returns rather than throws**. Locked in by regression tests in `error-sanitizer.test.ts`.
- Audit log needs **no migration**: `success:false` + fixed sentinel `CANCELLED_LOG_MESSAGE` in the existing `error` field (`query_log.success` is NOT NULL and the table is documented write-once).
- Coverage beyond the Execute button (user chose "everything long-running"): dashboard widgets abort on connection-switch/unmount; **introspection cancels cooperatively** via `signal.throwIfAborted()` between tables — the loop is what's slow, not any single query, which is why this works on SQLite too — with `POST /api/schema/cancel-introspection`, a new `cancelled` job status, and the poller updated (it only stopped on completed/error, so `cancelled` would have looped forever); sample-data aborts on collapse/unmount. Deliberately NOT `connection/test`, whose failure mode is a hanging *connect* — that needs a timeout, not a cancel.
- The duplicated `declare global processStatus` block (start-introspection + status routes) is now `lib/schema/introspection-jobs.ts`.

**Feature 2 — dirty reads ("NOLOCK"), user toggle, default OFF.** Enforced at the **adapter isolation level, never by rewriting SQL**: `sql-validator.ts` rejects `SET TRANSACTION ISOLATION LEVEL ...` in user SQL at three independent points (`WRITE_KEYWORDS` contains `set`; `heuristicReadOnly` rejects embedded `;`; `validateReadOnlySql` rejects `statements.length > 1`), and per-table hints would miss tables reached through views while `sqlify` re-emits the whole statement bracket-quoted.
- **SQL Server**: one line — `tx.begin(sql.ISOLATION_LEVEL.READ_UNCOMMITTED)`. Per-TRANSACTION, so it cannot leak through the pool; never convert to session-level. Pass `undefined`, never `0` (`0x00` is tedious's NO_CHANGE, absent from mssql's map → throws "Invalid isolation level").
- **MySQL**: `SET SESSION TRANSACTION ISOLATION LEVEL READ UNCOMMITTED` in `connect()`, NOT in `executeRawQuery` — MySQL raises ER_CANT_CHANGE_TX_CHARACTERISTICS (1568) if characteristics change while a transaction is open, and `START TRANSACTION READ ONLY` is issued there. Fails open. Safe at session scope only because `createConnection` is per-request; a pool would leak it.
- **PG and SQLite are genuine no-ops**, `executeRawQuery` untouched, with comments at the assignment so nobody reads it as a bug. Response carries `dirtyReadApplied` (`true`/`false`/absent) so the no-op is reported, not hidden.
- **No AI prompt change** — considered and rejected: the only emittable thing is `WITH (NOLOCK)`, redundant with the transaction setting and creating silently mixed isolation wherever the model forgets a table. The `limitRule` precedent doesn't transfer because isolation isn't in the SQL text, so the model can't be a second enforcement point.
- Preference mirrors `defaultQueryLimit` across 7 files; the JSONB **read-merge-write** is load-bearing (the PUT replaces the whole column) and now has its first test.

**Prerequisites (user approved bundling).** (a) `sqlserver.adapter.ts` used mssql's module-global `sql.connect()`; verified in `node_modules/mssql/lib/global-connection.js:16-18` that the **first caller's config wins permanently** and `close()` nulls the global — so two concurrent SQL Server requests to different connections could run one user's SQL against the other's DB, and either `disconnect()` could tear down the other's pool. Now a per-instance `ConnectionPool`. (b) Masking `finally` rollbacks/disconnects guarded (`.catch`/try) — after a cancelled query these throw far more often and would replace the real error. (c) `QUERY_TIMEOUT.STATEMENT_MS` (120s) applied per dialect — the only backstop for SQLite and multi-instance deploys, and mssql's implicit 15s default was too short for cancellation to even matter. (d) `postgres` pinned `latest` -> `^3.4.9`. (e) `SECURITY.CSRF_SKIP_PATHS` deleted — verified dead (only occurrence was its own definition; `shouldSkipCSRF` hardcodes `['/api/auth/']`), and it falsely implied `/api/query/execute` was unprotected. Consequence: the new cancel route needed zero CSRF work.

- Gate: tsc 0, lint 0/0, **303/303 vitest** (was 241; +62 in `query-registry`, `dirty-read`, `dirty-read-storage`, `preferences-merge`, `error-sanitizer` additions, `query-cancel-button`, `dirty-read-toggle`), `next build` passes with both new routes in the manifest.
- **NOT yet verified live** — needs a running dev server + real MySQL/SQL Server. See todos.md for the manual checklist; the driver-level kill and the isolation behavior cannot be unit-tested (mocking would test the mock).

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

### setup-authentik.sh reconciles redirect URI (2026-08-12)
Fixed `scripts/setup-authentik.sh`: the "OAuth2 provider already exists" branch skipped
straight past the provider, so a redirect URI registered by an earlier run (`localhost:3030`)
survived in the Authentik volume and broke the OIDC callback once the app moved to
`localhost:3000`. That branch now compares registered `redirect_uris` against
`$APP_CALLBACK_URL` and PATCHes when they differ. Gotchas filed in `.memories/notes.md`
(idempotent-by-skip ≠ idempotent for mutable config; never re-paste the script's freshly
generated `APP_ENCRYPTION_KEY` over one that already encrypted stored passwords).

### Share-list authorization fix (2026-08-12)
`GET /api/sharing/connections/[id]` and `GET /api/sharing/reports/[id]` were gated only on
being authenticated, letting any logged-in user enumerate the emails/names a connection or
report was shared with. Ownership checks added in `lib/db/repositories/sharing-repository.ts`
(`getSharesForConnection`/`getSharesForReport` now take `ownerId`, return `null` for non-owners);
both routes map `null` → `forbidden()`. Enforced in the repo layer so a future route can't
reintroduce the hole. tsc 0, lint 0/0, 212 tests pass.

### Chart generation migrated to the Responses API (2026-08-12)
`/api/chart/generate` was the last route on `chat.completions.create`; reasoning models
(gpt-5.6-sol) reject function tools there, returning HTTP 400. Migrated to `responses.create`,
converted `CHART_TOOLS` to the Responses API's flat function-tool shape, and switched output
parsing to `.find(type === 'function_call')` because a `reasoning` item precedes the call.
Verified live against gpt-5.6-sol: status `completed`, returned a valid `create_bar_chart`
config. Details in `.memories/notes.md`.

### OPENAI_MODEL code fallbacks standardized (2026-08-12)
The four routes carrying a literal fallback (`chart/generate` "gpt-5-mini", `dashboard/suggestions`
"gpt-5", `schema/generate-descriptions` "gpt-5", `query/followup` "gpt-5.1") now all fall back to
`gpt-5.6-terra`; model id confirmed live via `GET /v1/models/gpt-5.6-terra` → 200. These apply only
when `OPENAI_MODEL` is unset. `query/generate`, `query/revise`, and `query/enhance` still have NO
fallback (bare `process.env.OPENAI_MODEL`) — left as-is deliberately so a missing env var fails loudly.

### Provider-neutral OIDC: Authentik + Azure Entra ID (2026-08-12)
Auth mode was hardcoded to Authentik in four places. Now one deployment serves either IdP,
selected purely by env, with defaults that reproduce the old behavior exactly.
- **New** `lib/auth/oidc-profile.ts` — pure claim mapping: `resolveEmail` (email →
  preferred_username → upn), `resolveName`, `extractClaimIdentities` (merges `groups` +
  `roles`), `hasGroupsOverage`, `matchesAdmin` (comma-separated, case-insensitive). 29 tests
  in `tests/unit/oidc-profile.test.ts`.
- **`lib/auth/config.ts`** gained `getProviderId`/`getProviderName`/`getScopes`/`getAdminSpec`
  (defaults `authentik` / `Authentik` / `openid email profile groups` / `dataquery-admins`).
- **`auth-options.ts`** now takes id/name/scope/claims from those; both the initial-login and
  the `!token.userId` recovery branch use the same normalized values.
- **Client no longer hardcodes the provider**: `/api/config/auth-status` returns
  `providerId`+`providerName`; `app/auth/login/page.tsx` and `hooks/use-auth.ts` consume it.
- Admin now matches a group NAME, a group GUID, or an Entra App Role.
- Docs: new `docs/guides/azure-entra-setup.md`; `auth-and-data-layer.md`, `.env.example`,
  `CLAUDE.md`, both doc indexes updated.
- **Verified**: tsc 0, lint 0/0, 241 tests. Authentik regression — `auth-status` and
  `/api/auth/providers` byte-identical to pre-change, login button still "Sign in with
  Authentik", authorize `scope=openid+email+profile+groups`. Entra shape simulated by setting
  the two env vars: button became "Sign in with Microsoft" and authorize
  `scope=openid+email+profile` while `redirect_uri` stayed `/api/auth/callback/authentik`.
  Env then reverted and defaults re-confirmed.

### Fixed query-accuracy sync (PG 42804) (2026-08-12)
`applyDelta` in `lib/db/repositories/query-accuracy-repository.ts` was failing every call with
`GREATEST types text and integer cannot be matched`, so accuracy counters silently never synced
in auth mode. postgres.js sends bind parameters untyped and Postgres resolved them to `text`.
Added `::int` to every numeric parameter (including the `column + $n` ones, which would have
failed next as `integer + text`) and `Math.trunc()` in JS so a float from the route's
`Number(body.totalDelta)` can't break the cast. Verified against the live compose Postgres via a
throwaway probe: insert path, ON CONFLICT path, successful≤total, counters≥0, and float
truncation all pass. Details in `.memories/notes.md`.


### Azure deployment guide HTML (2026-08-12)
Researched (via exploration agents) everything needed to self-host on Azure with Entra ID and
produced `docs/guides/azure-deployment-guide.html` — self-contained HTML runbook covering:
provisioning (App Service/Container Apps single instance + PG Flexible Server + ACR + Key
Vault; Redis confirmed NOT needed — only the Authentik test stack uses it), full Entra .env
sample (`AUTH_OIDC_SCOPES=openid email profile` mandatory; callback stays
`/api/auth/callback/authentik` unless AUTH_OIDC_PROVIDER_ID is changed; `?sslmode=require` on
APP_DATABASE_URL since lib/db/pool.ts sets no ssl option), Entra app-registration steps (App
Role recommended over groups claim to dodge ~150-group overage), Azure settings
(WEBSITES_PORT=3000, Key Vault refs, PG firewall/VNet), go-live steps, and gotchas
(migrations log-but-don't-crash on failure; single-instance in-process state).

### Adversarial review of Azure deployment guide (2026-08-12)
Three adversarial agents reviewed `docs/guides/azure-deployment-guide.html` (codebase claims vs
repo, Azure/Entra claims vs Microsoft Learn, end-to-end runbook walkthrough). Refuted & fixed:
KV firewall "trusted Microsoft services" checkbox does NOT cover Key Vault references (VNet
integration is the reliable path); broken KV reference passes the LITERAL string through (never
empty) so auth activates with garbage — not a localStorage fallback; `flexible-server db create`
takes `-n` not `-d`; groups overage is 200 for JWT (150 is SAML); migrations are now 001–007
(007_connection_schema_namespace.sql exists); OPENAI_MODEL has no fallback only on
generate/enhance/revise — 4 other AI routes silently fall back to hardcoded gpt-5.6-terra;
sslmode=require works but Microsoft recommends verify-full. Also added: ACR pull auth step
(admin user disabled by default on Basic — AcrPull via managed identity), literal
`az webapp config appsettings set` command, pick-hostname-first step, KV creation in the
numbered steps, expected-migration-failure note before firewall opens, health check is
liveness-only caveat.
