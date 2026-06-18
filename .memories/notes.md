# Notes / Gotchas / Lessons Learned

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
