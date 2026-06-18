# Notes / Gotchas / Lessons Learned

## SQL Safety / Read-only / Audit / Learning (2026-06-18)
- **SQL safety is no longer a keyword blocklist.** It's `validateReadOnlySql()` (`lib/database/sql-validator.ts`) + read-only transaction execution in adapters.
- **The validator is HYBRID, not pure fail-closed** (changed 2026-06-18 after a real bug): node-sql-parser's PG grammar rejects common valid SQL — `TIMESTAMP WITH TIME ZONE '...'` and `timestamptz '...'` typed literals both throw. So: AST parse is primary (single statement, type must be `select`); **when astify() THROWS**, fall back to `heuristicReadOnly()` — strip comments/string-literals/quoted-identifiers, then require a single statement starting with SELECT/WITH and containing NO write keyword (`WRITE_KEYWORDS` regex incl. `into` for SELECT-INTO, `set`, data-modifying-CTE verbs). This blocks stacked statements, data-modifying CTEs, SELECT INTO while allowing valid analytics SQL. The read-only transaction is the execution-level backstop. NOTE the `\bdelete\b` style word-boundaries correctly DON'T flag `deleted`/`created_at`/`updated_at`/`regexp_replace`.
- **node-sql-parser quirks** (verified v5.4.0): `astify()` returns an object for one statement, an **array** for multiple; empty string → array length 0; PRAGMA/garbage → throws. `node.type` is lowercase `'select'`/`'update'`/`'drop'`/etc. CTE (`WITH..SELECT`) → type `'select'`. SQL Server dialect key is `'transactsql'`.
- **PG read-only**: `postgres` pkg `client.begin('read only', cb)` issues `BEGIN read only`; TransactionSql has `.unsafe()`. Committing a RO tx is safe. **SQL Server** has NO true read-only tx — we wrap+always-ROLLBACK; some DDL auto-commits so the AST validator is the real defense there. **SQLite** readonly is connect-time only (`new Database(path,{readonly:true})`), can't be per-query — hence the connect-time `config.readOnly` flag design.
- **Query audit log is separate from query history.** History = device-local localStorage (both modes), for the user. Audit log (`lib/query-log.ts`) = server-side, app DB (`query_log`, migration 005) when `isAppDbEnabled()` else `logs/query-log.jsonl`. Both fire-and-forget. Audit log must NEVER carry credentials (QueryLogEntry shape has none; route builds `logBase` explicitly).
- **"Learn from previous queries" is fully client-assembled + device-local.** History never syncs to Postgres in either mode, so examples (from `getQueryHistory()`) and corrections (`query_corrections` localStorage) are gathered client-side and POSTed to `/api/query/generate`; server only renders them into guarded prompt sections. No new DB migration for examples/corrections. Examples filtered by dbType (history has no fingerprint); corrections filtered by schema fingerprint.
- **TEST ENV GOTCHA**: `better-sqlite3` native addon does NOT load under vitest (and its `.node` binary is currently missing in node_modules locally — `pnpm rebuild better-sqlite3` if a real SQLite run is needed). So SQLite adapter integration can't be vitest-tested here; validator/fingerprint/relevance/log are pure and are unit-tested. Live DB integration (PG read-only tx, audit rows, prompt injection) was NOT run this session — demo Postgres wasn't up.

## Learning Feature Phase 2 — team-wide corrections (2026-06-18)
- **Corrections are now a synced data type; examples/history are NOT.** Phase 2 moved ONLY corrections to a Postgres pool (auth mode); examples still come from device-local `query_history` via `getQueryHistory()`. Don't "sync examples" by syncing history — that contradicts the device-local-by-design history.
- **Corrections used to bypass `StorageProvider` entirely** (the query page imported `utils/query-corrections` directly). Phase 2 routed them through the provider + context (`recordQueryCorrection`/`getCorrectionsForFingerprint`/`updateQueryCorrection`/`deleteQueryCorrection`). The `utils/query-corrections.ts` localStorage helpers are now reached ONLY via `LocalStorageProvider` and the context's no-provider fallback.
- **The pool is keyed by schema fingerprint, NOT by user.** `getByFingerprint` has NO `owner_id` filter — that's intentional (team-wide). `owner_id` is attribution + curation-rights only and is `ON DELETE SET NULL` so shared corrections survive user deletion. Distinct DBs with identical table/column names collide by fingerprint — accepted (single-tenant app).
- **Dedup uses `INSERT ... ON CONFLICT DO NOTHING` with NO conflict target** (catches both the `id` PK and the `(schema_fingerprint, md5(bad_sql), md5(good_sql))` unique index). Don't add a target — the md5 expression index makes targeting awkward and we want either violation to no-op.
- **Curation permission is enforced in SQL** (`WHERE id=$ AND (owner_id=$user OR $isAdmin)`), not just in the UI. The UI `canManage` only hides buttons. `${isAdmin}` is passed as a JS boolean — postgres.js types it as bool.

## Architecture
- Database adapter pattern: `lib/database/factory.ts` uses registry pattern - call `DatabaseAdapterFactory.create(type)` to get adapter
- All API routes that call OpenAI check rate limits first, accept user keys via `x-user-openai-key` header
- Server connections (from config/databases.json) have passwords stripped before sending to client; server-side operations use `getServerConnectionCredentials()` to get full credentials
- Error messages from databases are sanitized via `utils/error-sanitizer.ts` to prevent credential leaks
  - As of bug-fixes branch: user/query-logic errors (column/table not found, syntax, constraints) now surface the **raw DB message** (which names the offending column/table) via `normalizeDbDetail()` + a `detail` field on `SanitizedError`. Only connection/auth/unknown errors stay generic. Safe because users query their own DB and already see the schema; also feeds the auto-revise flow. Patterns added for SQLite (`no such column/table`) and SQL Server (`invalid column name`/`invalid object name`/`ambiguous column`).

## Common Issues
- Vector stores can expire/be deleted on OpenAI side - handle 404 errors gracefully, auto-reupload schema
- `isInitialized` must be checked before rendering components that depend on context data
- Always update both connections array AND currentConnection when modifying the active connection
- Schema must be uploaded to OpenAI before queries can be generated (creates file + vector store)
- Tables/columns marked `hidden: true` are filtered out before uploading to OpenAI

## State Management
- Context provider: `DatabaseConnectionOptions` in `lib/database-connection-options.tsx`
- StorageProvider abstraction: `lib/storage/storage-provider.ts` interface
  - `LocalStorageProvider`: localStorage (when auth disabled, default)
  - `ApiStorageProvider`: calls /api/data/* routes (when auth enabled)
- Determined at startup via `/api/config/auth-status` endpoint
- localStorage is the persistence layer for single-user mode
- sessionStorage is used for OpenAI API keys (not persisted across sessions)
- Server config merged with local connections on startup

## Authentication Architecture
- Auth is optional: enabled when AUTH_OIDC_ISSUER + AUTH_OIDC_CLIENT_ID + AUTH_OIDC_CLIENT_SECRET are all set
- Auth.js v5 with JWT strategy (no database sessions)
- **AUTH_URL env var required** by Auth.js v5 (e.g. `http://localhost:3000`) — without it, sign-in gets a "Configuration" error
- Admin detection via Authentik groups claim: user in AUTH_ADMIN_GROUP group gets isAdmin=true
- All API routes call `getAuthContext(request)` which returns null when auth disabled (pass-through)
- Connection credentials resolved from app DB (encrypted) when auth enabled, not from client payload
- **Client sends only connectionId** when auth enabled (not credentials). Server resolves via `validateConnection`. Endpoints accept both `{ connectionId, source, type }` (auth mode) and `{ connection }` (no-auth mode) for backwards compat.
- Server connections stored in DB (source='server') when auth enabled; also resolved from config/databases.json as fallback
- DB-managed server connections: `owner_id` is nullable (migration 002) — server connections have no owner
- Data migration dialog shows on first login when localStorage has data

## Auth Testing Notes (Authentik 2024.12)
- `AUTHENTIK_BOOTSTRAP_TOKEN` env var does NOT reliably create API tokens — must insert via psql
- Authentik 2024.12 API changes: `/propertymappings/scope/` → `/propertymappings/provider/scope/` for creating scope mappings; use `/propertymappings/all/` to list all
- Provider creation requires `invalidation_flow` field and `redirect_uris` as array of objects `[{"matching_mode": "strict", "url": "..."}]`
- Authentik UI uses deeply nested web components (shadow DOM) — Playwright `locator` can pierce but `evaluate` cannot easily
- Auth.js v5 `NextAuth()` returns `{ handlers, auth, signIn, signOut }` — must destructure `handlers` to get `{ GET, POST }`
- Authentik API pagination: `count` is at `data.pagination.count`, NOT `data.count` — use `data.get('pagination',{}).get('count', 0)`
- Authentik property mappings can have `managed: null` (JSON null) — use `r.get('managed') or ''` not `r.get('managed', '')` (default only applies for missing keys, not null values)
- Authentik flows may not be available immediately after API returns 200 — add retry loop for flow lookups
- On Windows: `mktemp` creates `/tmp/` paths that native Python can't read — use a file in the current directory instead
- On Windows: inline Python `$PYTHON -c "..."` blocks need `import os` if using `os.path.join` or `os.getcwd()`

## Database Introspection Gotchas
- PostgreSQL PK detection subquery: DO NOT join pg_attribute in the subquery — `unnest(i.indkey)` × `pg_attribute` rows creates a cross-product for composite PKs, duplicating columns. Only select `i.indrelid, unnest(i.indkey) as attnum` from `pg_index`.
- Base adapter `introspectSchema()` deduplicates columns by name using a Map as defense-in-depth
- The `CASE WHEN pk.attnum IS NOT NULL` check is sufficient (no need for `pk.attname`)

## postgres.js (npm `postgres`) Gotchas
- **JSONB double-serialization**: NEVER use `JSON.stringify()` when passing values to JSONB columns in tagged template literals. The postgres.js driver auto-serializes JS objects for JSONB. Use `sql.json(value)` instead. `JSON.stringify()` causes double-serialization — the DB stores a JSON string instead of a JSON object/array, and on retrieval the value comes back as a string instead of the expected type (e.g., `schema.tables.some is not a function`)
- **UNDEFINED_VALUE error**: Passing `undefined` to tagged template parameters throws `UNDEFINED_VALUE`. Always ensure values are defined or use `null` fallback.
- **getToken() requires explicit secret**: `getToken({ req, secret: process.env.AUTH_SECRET })` — omitting secret causes 401s even with valid JWTs

## Query History (2026-06-18)
- Query history is **device-local by design**: stored in localStorage (`query_history` key) in BOTH auth and no-auth modes. NOT synced to the app DB (no migration/repo/route) — it's low-sensitivity convenience data and keeping it local avoids debt. `ApiStorageProvider.*QueryHistory` deliberately use localStorage, not `/api/data/*`.
- Capped ring buffer: `HISTORY.MAX_ENTRIES = 200`, newest-first, oldest trimmed in `addQueryHistory`.
- `recordQueryHistory` in context is fire-and-forget — wrapped so a history-write error can NEVER break query execution.
- Capture happens once, at `executeTabQuery` in `app/query/page.tsx` (the single execution choke point) — covers ad-hoc + report-run + follow-up queries. **Successful executions only** (failures are not recorded; the catch block does NOT call recordHistory). History page filters legacy failed entries via `success !== false`.
- Each history entry leads with the plain-English `question` (the natural-language prompt) as the prominent headline, then metadata, then SQL.
- Re-run reuses the existing query-page URL mechanism: `/query?sql=<encoded>&autoExecute=true` (also sets the entry's connection active first).

## TypeScript / Build Gotcha (important)
- `next.config` sets `typescript.ignoreBuildErrors: true` AND `eslint.ignoreDuringBuilds: true`. `npx tsc --noEmit` reports HUNDREDS of pre-existing `TS2304 Cannot find name 'DatabaseConnection'/'SavedReport'` errors across the repo — these are BASELINE NOISE, not regressions. The model interfaces in `models/*.interface.ts` are referenced cross-file without imports and only "work" because type errors are ignored at build and erased at runtime. Don't try to "fix" these; verify with `next build` (runtime/bundle), not `tsc`.
- `npm run build` intentionally does `rimraf node_modules && pnpm install && next build` — a bare `npx next build` can fail with `Cannot find module '.../jest-worker/processChild.js'` from an incomplete pnpm store. Use the npm script for a real build.

## Documentation Patterns
- CLAUDE.md is the primary reference for Claude Code - keep project structure tree up to date
- docs/ folder has detailed documentation organized by topic
- When adding new files/features, update both CLAUDE.md structure tree and relevant docs/ files
- .memories/ files track cross-session state - always update after completing tasks
