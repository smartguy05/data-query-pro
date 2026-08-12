# Notes / Gotchas / Lessons Learned

> **Durable engineering gotchas now live in [docs/reference/lessons-learned.md](../docs/reference/lessons-learned.md)** —
> postgres.js (JSONB `sql.json`, UNDEFINED_VALUE, getToken secret), PostgreSQL PK
> cross-product, SQL-safety hybrid validator + read-only tx per dialect, audit-log vs
> query-history, learning-feature pool invariants, sharing `.map(toClientX)` index trap,
> Authentik 2024.12 testing, better-sqlite3/vitest, build state. Read that first.
>
> This file holds only **cross-session, project-specific** state not yet filed into docs.

## Build / Type Safety — CURRENT STATE (corrected)
- `next.config.mjs` has `typescript.ignoreBuildErrors: false` + `eslint.ignoreDuringBuilds: false`
  — `next build` enforces type-check + lint and fails on errors. Codebase is clean
  (tsc 0, lint 0/0, 138 vitest tests pass).
- `models/*.interface.ts` are proper exported modules — `import type { X } from '@/models/...'`.
  (The old global-ambient pattern that required `ignoreBuildErrors` is gone.)
- `build` is plain `next build`; use **pnpm**. If build dies on a missing
  `jest-worker/processChild.js`, run `pnpm install --force` (non-destructive).
- (Any note claiming `ignoreBuildErrors: true` or a destructive rimraf build script is
  STALE — that was fixed 2026-06-18.)

## Quick Architecture Reminders
- Adapter factory: `DatabaseAdapterFactory.create(type)` (registry pattern, `lib/database/factory.ts`).
- Storage abstraction: `LocalStorageProvider` (auth off, localStorage) / `ApiStorageProvider`
  (auth on, `/api/data/*`). Mode determined at startup via `/api/config/auth-status`.
- All OpenAI routes check rate limits first + accept `x-user-openai-key`.
- All API routes call `getAuthContext(request)` → null when auth disabled (pass-through).
- Server connections (config/databases.json): passwords stripped before client; server-side
  uses `getServerConnectionCredentials()`. `owner_id` nullable (migration 002).

## Eval harness gotchas (evals/, 2026-08-07)
- `/api/query/generate` swallows ALL errors and returns **HTTP 200 with mock SQL**
  (confidence 0.3, warning contains "mock response", information_schema query) — any client
  that only checks response.ok scores failures as passes. `evals/lib/classify.ts` detects it.
  A JSON-parse failure similarly returns `SELECT 1 as parsing_error` at 200.
- `lib/openai/schema-upload.ts` does NOT wait for vector-store ingestion — a generate call
  right after upload can hit an unindexed store. `evals/lib/vector-store.ts` polls to "completed".
- Demo DB seed data is **randomized per load AND time-anchored** (last-90-days events):
  a container seeded weeks ago returns 0 rows for "last 7 days" questions. Reseed before eval
  runs; golden + generated SQL must run against the same live instance in the same run.
- `dataquery-demo-db` container password is **demo** (docker-compose's demo-db block says demo123).
- `pnpm eval -- --flags`: pnpm forwards the literal `--` token; node:util parseArgs treats it
  as option terminator — run-eval.ts strips it before parsing. On PowerShell, comma lists
  must be quoted (`--questions "Q01,Q20"`) or PS splits them into separate args.
- Runner manages the demo DB container (start → wait → reseed → stop-on-exit, only if IT
  started it; also auto-reseeds a running-but-stale DB). First introspect fetch right after
  a container start reproducibly fails once ("fetch failed") — runner retries 3× with 3s gaps.
- Next dev must be (re)started AFTER adding EVAL_ALLOW_MODEL_OVERRIDE to .env.local; the
  runner's canary (bogus model name → expects mock fallback) catches an inactive flag.
- **Eval question authoring rule learned the hard way**: any literal the model must filter
  on (status/priority values, casing, underscores) MUST be quoted verbatim in the question,
  because the uploaded schema is structure-only (no example values, and NO VIEWS — see todos).
  Two baseline runs were invalidated by unknowable-literal/view-blindness dataset defects
  (Q12 'Critical' casing, Q27 customer_health view + 'in_progress').

## Environment (this dev machine)
- **better-sqlite3 native binding may be missing** after pnpm install (build scripts not run).
  Symptom: `Could not locate the bindings file`. Fix: `cd node_modules/better-sqlite3 && npx prebuild-install`
  (downloads the prebuilt .node; `pnpm rebuild better-sqlite3` alone did NOT produce it).
- **Orphaned dev server**: stopping a background `npm run dev` can leave the node child holding
  port 3000 (next `npm run dev` silently moves to 3001). Check `Get-NetTCPConnection -LocalPort 3000`
  and kill the owning PID. Also: running `next build` deletes/replaces `.next` under a live dev
  server → all `_next/static` chunks 404; restart dev with a fresh `.next`.

## node-sql-parser AST gotcha (v5.4, pinned by tests/unit/sql-limit.test.ts)
- For `A UNION B LIMIT 10`, the parser puts `limit` on the **last** node of the `_next` chain,
  not the root statement — existing-limit detection must walk `_next`.

## Process
- `.memories/` tracks cross-session state — update `completed.md`/`todos.md`/`notes.md` after tasks.
- When adding files/features, also update the CLAUDE.md structure tree + relevant `docs/`.

## Nested-button hydration error (fixed 2026-07-14)
- React 19 logs "In HTML, <button> cannot be a descendant of <button>... hydration error"
  once per offending element. Cause: the follow-up tab close "X" was a raw `<button>` inside
  Radix `TabsTrigger` (itself a `<button>`) in `app/query/page.tsx`.
- Fix: use `<span role="button" tabIndex={0}>` with onClick + Enter/Space onKeyDown instead.
  Rule: never put a button/Button inside TabsTrigger, SelectTrigger, or any Radix trigger
  without `asChild` -- they all render `<button>`.

## Duplicate React key = duplicate connection id (fixed 2026-07-14)
- "Encountered two children with the same key `<epoch ms>`" across many pages meant the
  connections array had the same id twice: `config/databases.json` was exported FROM
  localStorage, so the same connection existed as both a server connection and a local one,
  and `LocalStorageProvider.getConnections()` concatenated them without dedup.
- Fix: getConnections now filters local connections whose id exists in serverConnections
  (server wins), mirroring getSchemas/getReports. Connection ids are bare Date.now() strings.

## 2026-08-07: Eval harness smoke test (live)
- `pnpm eval -- --models ...` broke: pnpm forwards the literal `--` separator, which
  parseArgs treats as an option terminator, turning all flags into rejected positionals.
  Fix: parseCli in evals/run-eval.ts strips the first `--` from argv before parseArgs.
- checkServerUp's 10s timeout can fail on a cold Next dev server (first GET / triggers
  page compile > 10s). Warm the server (curl /) before running the eval.
- Live smoke (gpt-5.4, Q01/Q23/Q30, 1 trial): 3/3 PASS; JSONL + HTML written; HTML has
  no credentials; tsc clean.

## 2026-08-12: Eval comparator — tolerant equality is not transitive
- `evals/lib/compare.ts` used to decide "same rows in any order" by sorting canonical
  string keys (numbers rounded to 6 significant digits). That is wrong: cell equality is
  tolerant (0.01 absolute), and tolerant equality is NOT transitive, so it cannot serve
  as a hash/sort key -- "4.16" ~= "4.17" ~= "4.18" but "4.16" !~= "4.18". Rounding also
  disagreed with the tolerance at bucket boundaries, so the same pair compared equal in
  scalar mode but unequal in unordered mode.
- Fix: multiset equality is now decided by an explicit bipartite perfect matching
  (Kuhn's augmenting path) over the tolerant predicate, so every comparison mode shares
  one definition of "equal". Result sets are tens of rows, so the cubic cost is free.
- The old canonical keys were joined with literal control characters (`\0`, `\x01`).
  The `\0` made git classify `evals/lib/compare.ts` as a BINARY file -- `git diff` showed
  only "Binary files differ" for a .ts source file. If that ever happens again, look for
  a NUL byte in a string literal. Removing it restored normal text diffs.
- Coverage moved from `evals/lib/compare.selfcheck.ts` (a hand-rolled
  `node --experimental-strip-types` script, never run by CI) to `tests/unit/compare.test.ts`,
  which `npm run test` picks up. All 14 original assertions were preserved.

## 2026-08-12: setup-authentik.sh left a STALE redirect URI (fixed)
- Symptom: auth stack comes up clean, OIDC discovery resolves, `/api/auth/providers` lists
  authentik -- but the login round-trip dies at the callback with a redirect_uri mismatch.
- Cause: the Authentik provider persists in the `dashboard_authentik_db_data` volume across
  runs. `setup-authentik.sh` is idempotent by *skipping* anything that already exists, so a
  provider created by an earlier session (registered against `localhost:3030`) was never
  reconciled when the app later ran on `localhost:3000`. Re-running the script did NOT fix
  it -- it just logged "OAuth2 provider already exists, skipping creation" and moved on.
- Fix: the "already exists" branch now compares the registered `redirect_uris` against
  `$APP_CALLBACK_URL` and PATCHes the provider when it doesn't match.
- Lesson: idempotent-by-skip is not idempotent for *mutable* config. Anything derived from
  a port/host that can change between runs must be reconciled, not skipped.
- To check by hand:
  `curl -s -H "Authorization: Bearer test-api-token-for-setup" \
    "http://localhost:9000/api/v3/providers/oauth2/?name=DataQuery+Pro+OIDC"` -> `redirect_uris`.

## 2026-08-12: APP_ENCRYPTION_KEY must survive re-running setup-authentik.sh
- The script prints a FRESHLY GENERATED `APP_ENCRYPTION_KEY` (and `AUTH_SECRET`) on every
  run. Pasting the whole block into `.env.local` rotates the key and makes every
  `password_enc` already stored in `database_connections` undecryptable (AES-256-GCM auth
  tag fails) -- connections silently stop being able to connect.
- Rule: on a re-run, take only the `AUTH_OIDC_*` values. Keep the existing
  `APP_ENCRYPTION_KEY`. Rotating `AUTH_SECRET` is harmless (it only invalidates JWT sessions).

## 2026-08-12: reasoning models reject function tools on /v1/chat/completions
- Symptom: chart generation returned `400 Function tools with reasoning_effort are not
  supported for gpt-5.6-sol in /v1/chat/completions. To use function tools, use /v1/responses
  or set reasoning_effort to 'none'.`
- The route never set `reasoning_effort` itself -- the model applies one by default, and that
  default collides with `tools` on Chat Completions. So grepping for `reasoning_effort` finds
  nothing and the cause looks invisible.
- `/api/chart/generate` was the LAST route still on `client.chat.completions.create`; the other
  six OpenAI routes already use `client.responses.create`. Fix was to migrate it, not to set
  `reasoning_effort: 'none'` (which would silently disable reasoning for chart selection).
- **Function-tool shape differs between the two APIs.** Responses is FLAT:
  `{ type:'function', name, description, parameters, strict }`. Chat Completions NESTS:
  `{ type:'function', function:{ name, description, parameters } }`. `CHART_TOOLS` in
  `models/chart-config.interface.ts` was converted to the flat shape (it had no other consumer)
  so nobody copies the wrong one. `strict: false` -- these schemas have optional properties.
- **Parsing differs too.** Responses returns a flat `response.output` array and the model emits
  a `reasoning` item BEFORE the `function_call`. Verified live: `output item types: reasoning,
  function_call`. So you must `.find(i => i.type === 'function_call')` -- indexing `output[0]`
  grabs the reasoning item and looks like "AI did not generate a chart configuration".

## 2026-08-12: share-list GET endpoints leaked to any authenticated user (fixed)
- `GET /api/sharing/connections/[id]` and `GET /api/sharing/reports/[id]` checked only that the
  caller was authenticated -- no ownership check -- so any logged-in user who knew or guessed an
  id could enumerate the emails and names it was shared with. Connection ids are bare
  `Date.now()` strings, so guessing is cheap. POST/DELETE on those routes were always owner-gated;
  only the reads were open.
- Fix: the ownership check lives in the REPOSITORY (`getSharesForConnection`/`getSharesForReport`
  now take `ownerId` and return `null` when the caller isn't the owner), so a future caller can't
  reintroduce the hole by forgetting a route-level guard. Routes map `null` -> `forbidden()`.
- Owner-only, deliberately matching POST/DELETE -- there is no admin bypass on these routes. The
  ShareDialog is only rendered for owners anyway (`canShare = authEnabled && !isServer && !isShared`),
  so no UI depended on the looser behavior.

## 2026-08-12: postgres.js untyped params break GREATEST/LEAST (42804)
- `PUT /api/data/query-accuracy` 500'd with `GREATEST types text and integer cannot be matched`
  (PG 42804) from `applyDelta` in `lib/db/repositories/query-accuracy-repository.ts`.
- Cause: **postgres.js sends bind parameters with an unspecified type**, and Postgres resolves
  an unspecified parameter to `text` when it has no other context. `GREATEST($1, 0)` then
  compares text against an integer literal and dies. This is NOT specific to GREATEST — the
  same statement's `query_accuracy_stats.total + $1` would have failed next as `integer + text`.
- Fix: an explicit `::int` on EVERY numeric parameter, plus `Math.trunc()` in JS first, because
  a fractional value would make the cast itself fail ("invalid input syntax for type integer").
  The route does `Number(body.totalDelta) || 0`, so a float really can arrive from a client.
- Rule of thumb: any bind parameter used inside `GREATEST`/`LEAST`/`COALESCE`, or added to a
  column, needs an explicit cast under postgres.js. Column-position parameters in a plain
  `INSERT ... VALUES` are fine — Postgres infers those from the target column.
- **Not catchable by the current test suite** — `tests/unit` is all pure functions with no DB.
  Verified instead with a throwaway `tsx` probe that imported the real repository and ran it
  against the compose Postgres, asserting both code paths (insert + ON CONFLICT) and both
  clamping invariants (successful ≤ total, counters ≥ 0). Worth repeating for repo-layer fixes.

## 2026-08-12: OIDC claim differences, Authentik vs Entra ID
Why `lib/auth/oidc-profile.ts` exists. Each of these fails DIFFERENTLY, and three fail silently:
- **`groups` is not a scope in Entra.** Authentik defines a custom `groups` scope; Entra rejects
  it. Entra emits group/role data via the app registration's *optional claims*. Hence
  `AUTH_OIDC_SCOPES` -- Entra must use `openid email profile`.
- **`email` is often absent in Entra**; the UPN lives in `preferred_username`. `users.email` is
  `NOT NULL`, so a missing email made `upsertUser` throw -- and the surrounding try/catch
  SWALLOWED it, leaving `token.userId` unset. Symptom: user looks signed in, every
  `/api/data/*` route fails, only `Failed to upsert user` in the log. Fixed by the
  email → preferred_username → upn fallback plus an error message that names the resolved email.
- **Entra `groups` holds object GUIDs, not names**, so a name-based `groups.includes()` never
  matched and nobody got admin. `matchesAdmin` now compares case-insensitively against merged
  `groups`+`roles`, so a name, a GUID, or an App Role all work.
- **Groups overage**: past ~150 memberships Entra drops `groups` for `_claim_names`/
  `_claim_sources` (Graph lookup required). We detect and warn rather than resolve; App Roles
  are immune, which is why the guide recommends them.
- **Provider id is part of the callback URL** (`/api/auth/callback/<id>`), so it defaults to
  `authentik` forever -- changing it invalidates already-registered redirect URIs.

Testing trick: you can exercise the Entra *shape* without a tenant. Set
`AUTH_OIDC_PROVIDER_NAME` + `AUTH_OIDC_SCOPES`, restart, then read the authorize URL out of the
signin redirect:
```
CSRF=$(curl -s -c jar localhost:3000/api/auth/csrf | python -c "import json,sys;print(json.load(sys.stdin)['csrfToken'])")
curl -s -b jar -c jar -i -X POST localhost:3000/api/auth/signin/authentik \
  -H "Origin: http://localhost:3000" --data-urlencode "csrfToken=$CSRF" | grep -i ^location:
```
The `scope=` in that Location header is the ground truth. Far more reliable than clicking the
button in a browser -- the first click after a page load frequently does not fire.

