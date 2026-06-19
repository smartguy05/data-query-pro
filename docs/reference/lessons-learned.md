# Lessons Learned & Gotchas

Durable engineering gotchas distilled from build/debug sessions. These are the
non-obvious traps that cost time — read before touching the relevant subsystem.
(Cross-session task state lives in `.memories/`; this file is the permanent home
for lessons worth keeping.)

## Build & Type Checking

- `next.config.mjs` enforces quality gates: `typescript.ignoreBuildErrors: false`
  and `eslint.ignoreDuringBuilds: false`. `next build` therefore **runs a full
  type-check + lint and fails on any error**. The codebase is clean (tsc 0 errors,
  lint 0/0).
- Model interfaces in `models/*.interface.ts` are **proper exported modules** — use
  `import type { X } from '@/models/...'`. (The old global-ambient pattern, which
  forced `ignoreBuildErrors`, was removed.)
- `build` script is plain `next build`. There are also `clean` / `clean:build`
  scripts. If `next build` ever dies with a missing
  `next/dist/compiled/jest-worker/processChild.js`, `node_modules` is incomplete —
  run `pnpm install --force` (non-destructive) to repair.
- Project uses **pnpm**. Run `pnpm build` / `pnpm lint` / `pnpm test`.

## postgres.js (`postgres` npm package)

- **JSONB double-serialization**: never `JSON.stringify()` a value bound to a JSONB
  column in a tagged template — the driver auto-serializes objects. Use
  `sql.json(value)`. Stringifying stores a JSON *string*, so reads come back as a
  string and blow up (e.g. `schema.tables.some is not a function`).
- **`UNDEFINED_VALUE`**: passing `undefined` to a template parameter throws. Use a
  `null` fallback.
- **`getToken()` needs an explicit secret**: `getToken({ req, secret: process.env.AUTH_SECRET })`
  — omitting it returns 401 even with a valid JWT.

## Database Introspection

- **PostgreSQL PK detection**: do NOT join `pg_attribute` inside the PK subquery.
  `unnest(i.indkey)` × `pg_attribute` produces a cross-product for composite PKs,
  duplicating columns. Select only `i.indrelid, unnest(i.indkey) as attnum` from
  `pg_index`; the `CASE WHEN pk.attnum IS NOT NULL` check is sufficient (no
  `pk.attname` needed). The base adapter also dedupes columns by name via a Map as
  defense-in-depth.

## SQL Safety (read-only enforcement)

- Safety is **not** a keyword blocklist. Two layers: `validateReadOnlySql()`
  (`lib/database/sql-validator.ts`) + read-only transaction execution in each adapter.
- The validator is **hybrid, not pure fail-closed**: `node-sql-parser` AST parse is
  primary (must be a single statement of type `select`; CTEs parse as `select`). But
  its PG grammar rejects valid SQL like `TIMESTAMP WITH TIME ZONE '...'` /
  `timestamptz '...'` literals, so **when `astify()` throws**, fall back to
  `heuristicReadOnly()` (strip comments/strings/quoted-identifiers, require single
  SELECT/WITH with no write keyword). Word boundaries mean `deleted` / `created_at` /
  `regexp_replace` are correctly NOT flagged.
- `node-sql-parser` v5.4.0 quirks: one statement → object, multiple → **array**;
  empty string → array length 0; PRAGMA/garbage → throws. `node.type` is lowercase.
  SQL Server dialect key is `'transactsql'`.
- Read-only execution per dialect: **PG** `client.begin('read only', cb)` + `.unsafe()`;
  **MySQL** `START TRANSACTION READ ONLY` + ROLLBACK; **SQL Server** has *no* true
  read-only tx — wrap + always ROLLBACK, so the AST validator is the real defense
  there (some DDL auto-commits); **SQLite** readonly is connect-time only
  (`new Database(path, { readonly: true })`) — hence the connect-time `config.readOnly`
  flag design. Introspection leaves the flag unset (stays writable).

## Audit Log vs Query History (don't conflate)

- **Query history** = device-local localStorage (`query_history`), both auth and
  no-auth modes, for the user's convenience. Capped ring buffer
  (`HISTORY.MAX_ENTRIES = 200`, newest-first). Captured once at `executeTabQuery`
  (`app/query/page.tsx`), **successful executions only**, fire-and-forget so a write
  can never break query execution. Intentionally **never synced** to the app DB —
  `ApiStorageProvider.*QueryHistory` deliberately use localStorage.
- **Audit log** = server-side (`lib/query-log.ts`, `logQuery()` fire-and-forget):
  app DB `query_log` table (migration 005) when `isAppDbEnabled()`, else JSONL to
  `logs/query-log.jsonl`. **Must never carry credentials** (the `QueryLogEntry` shape
  has no cred fields; the route builds its log object explicitly).

## Learning Feature (query examples & corrections)

- "Learn from previous queries" is **client-assembled + device-local** for examples:
  history never syncs, so examples (from `getQueryHistory()`, filtered by dbType) and
  corrections (by schema fingerprint) are gathered client-side and POSTed to
  `/api/query/generate`; the server only renders them into **guarded** prompt sections
  (empty → prompt unchanged).
- **Corrections are the one synced learning type** (auth mode, Phase 2); examples and
  history are NOT. Don't "sync examples" by syncing history — that contradicts the
  device-local-by-design history.
- The corrections pool is **keyed by schema fingerprint, not by user** — `getByFingerprint`
  has no `owner_id` filter (team-wide by design). `owner_id` is attribution +
  curation-rights only, `ON DELETE SET NULL` so shared knowledge survives user deletion.
  Distinct DBs with identical table/column names collide by fingerprint (accepted;
  single-tenant app).
- Dedup uses `INSERT ... ON CONFLICT DO NOTHING` with **no conflict target** (catches
  both the `id` PK and the `(schema_fingerprint, md5(bad_sql), md5(good_sql))` unique
  index). Don't add a target — the md5 expression index makes targeting awkward.
- Curation permission is enforced **in SQL** (`WHERE id = $ AND (owner_id = $user OR $isAdmin)`),
  not just the UI. The UI `canManage` flag only hides buttons.

## Connection / Report Sharing (UI)

- Sharing is **auth-mode only** — all sharing UI is gated on `authEnabled`. In
  localStorage mode there are no users.
- Per-item access is threaded from the server: `accessLevel` (`"owner" | "view" | "edit"`,
  `undefined` ⇒ owned) + `sharedByEmail` / `sharedByName` on `DatabaseConnection` /
  `SavedReport`, set by `getConnectionsForUser` / `getReportsForUser`.
- `toClientConnection` / `toClientReport` take an `accessLevel` second arg. **Callers
  using `.map(toClientX)` must wrap as `.map(r => toClientX(r))`** — otherwise `.map`'s
  index leaks into the `accessLevel` param (this broke the build once).

## Auth Testing (Authentik 2024.12)

- `AUTHENTIK_BOOTSTRAP_TOKEN` does NOT reliably create API tokens — insert via psql.
- API path changes: scope mappings moved to `/propertymappings/provider/scope/`; list
  via `/propertymappings/all/`. Provider creation requires `invalidation_flow` and
  `redirect_uris` as `[{"matching_mode": "strict", "url": "..."}]`.
- Pagination count is at `data.pagination.count`, not `data.count`. Property mappings
  may have `managed: null` (JSON null) — use `r.get('managed') or ''` (a default only
  applies to *missing* keys, not null values). Flows may lag after a 200 — add a retry loop.
- Auth.js v5 `NextAuth()` returns `{ handlers, auth, signIn, signOut }` — destructure
  `handlers` to get `{ GET, POST }`. **`AUTH_URL` is required** by Auth.js v5 or sign-in
  throws a "Configuration" error.
- Authentik UI is deep shadow-DOM web components — Playwright `locator` can pierce, but
  `evaluate` cannot easily.
- On Windows: `mktemp` paths under `/tmp/` aren't readable by native Python — use a file
  in the cwd; inline `python -c "..."` needs `import os` for `os.path`/`os.getcwd()`.

## Test Environment

- `better-sqlite3`'s native addon does **not** load under vitest (and the `.node`
  binary may be missing locally — `pnpm rebuild better-sqlite3` if a real SQLite run is
  needed). So the SQLite adapter can't be vitest-tested here; pure logic
  (validator, fingerprint, relevance, log) is unit-tested instead. Live-DB integration
  (PG read-only tx, audit rows, prompt injection, sharing routes/repo SQL) requires a
  running Postgres + auth session and is verified manually.

## Misc Runtime Gotchas

- OpenAI vector stores can expire / be deleted — handle 404s gracefully and re-upload schema.
- Always check context `isInitialized` before rendering components that depend on context data.
- When modifying the active connection, update **both** the `connections` array and
  `currentConnection`.
- Schema must be uploaded to OpenAI (creates file + vector store) before queries can be
  generated; tables/columns marked `hidden: true` are filtered out before upload.
- Error messages are sanitized (`utils/error-sanitizer.ts`): user/query-logic errors
  (column/table not found, syntax, constraints) surface the **raw DB message** (names the
  offending column/table) via a `detail` field; connection/auth/unknown errors stay
  generic to avoid credential leaks.
