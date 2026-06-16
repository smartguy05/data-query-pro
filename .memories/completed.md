# Completed Tasks

## Core Features (Complete)
- Multi-database support: PostgreSQL, MySQL, SQL Server, SQLite with adapter pattern
- Natural language to SQL query generation via OpenAI Responses API
- Query enhancement (improve vague queries with schema details)
- Self-correcting queries (revise failed SQL automatically)
- Follow-up questions on query results (new query or explanation)
- Schema introspection with background processing and polling
- AI-generated descriptions for tables and columns (batch processing)
- Schema change detection (new/modified flags after re-introspection)
- Column type auto-detection (text, number, currency, date, URL, empty)
- Manual column type override via dropdown
- Multi-tab query interface (original + follow-up tabs)
- Saved reports with parameterized queries ({{param}} syntax)
- Report favorites, cloning, import/export
- AI suggestions for metrics/reports based on schema
- Chart generation (bar, line, pie, area, scatter) via Recharts
- Dark/light theme support
- Server configuration via config/databases.json for team deployments
- Rate limiting with BYOK (bring your own key) bypass
- CSRF protection
- Error boundary for crash recovery
- Landing page with features, screenshots, and installation instructions
- Connection testing (real connectivity test with latency/version info)
- Data export/import (backup/restore connections, schemas, reports)

## Authentication & Multi-User Support (2026-02-05)
- Optional Authentik OIDC authentication via Auth.js v5 (next-auth)
- Dual-mode: localStorage (default) or PostgreSQL (when auth enabled)
- StorageProvider abstraction: LocalStorageProvider / ApiStorageProvider
- App database with auto-migration (instrumentation.ts + lib/db/migrate.ts)
- Password encryption (AES-256-GCM) for stored database credentials
- 10 PostgreSQL tables: users, database_connections, connection_schemas, saved_reports, suggestions_cache, user_preferences, dismissed_notifications, connection_shares, report_shares, server_connection_assignments
- Repository layer: 8 repository files in lib/db/repositories/
- CRUD API routes: /api/data/* (connections, schemas, reports, suggestions, preferences, notifications, import-local)
- Sharing API routes: /api/sharing/{connections,reports}/[id], /api/sharing/users/search
- Admin API routes: /api/admin/{users,server-connections,server-connections/[id]/assign,assignments}
- Auth context (getAuthContext) added to all 16 existing API routes
- Connection validator updated to resolve credentials from app DB in auth mode
- Login page with Authentik SSO button
- Navigation updated with user avatar, dropdown menu, admin link
- Admin panel for managing server connection assignments (users and groups)
- Share dialog component for connections and reports
- Data migration dialog: import localStorage data on first authenticated login
- Middleware updated: auth check, CSP form-action for Authentik issuer
- CSRF exemption for /api/auth/ routes
- useAuth hook for client-side auth state

## Auth Testing Infrastructure (2026-02-06)
- docker-compose.auth-test.yml: Authentik + app DB + demo DB (6 containers)
- scripts/setup-authentik.sh: auto-configures OIDC provider, application, groups, test users via API
- docs/guides/authentication-testing.md: developer guide for auth testing setup
- Fixed NextAuth route handler: destructure `handlers` from `NextAuth()` return value
- Added AUTH_URL to .env.example and CLAUDE.md

## Auth Bug Fixes (2026-02-06)
- Fixed DataMigrationDialog showing before user is logged in (added useAuth check)
- Fixed DatabaseConnectionOptions making API calls before session is established
- Fixed getAuthContext missing `secret` param in getToken() causing 401s
- Fixed JWT callback to retry userId lookup if initial upsert failed (DB not ready)
- Fixed JSONB double-serialization in all 4 repositories (schema, report, suggestion, preference) — changed JSON.stringify() to sql.json() and added parseJsonb safety on retrieval
- Fixed "connection data is required" error: admin page test connection wrapping
- Fixed migration 001 idempotency: added DROP TRIGGER IF EXISTS before CREATE TRIGGER
- Fixed migration 002 robustness: IF NOT EXISTS guards on FK constraints
- Fixed page flash/reload UX: added ContentLoadingGate component
- Fixed stale data after admin deletes: added refreshConnections() to context
- Fixed "server connection not found" during introspection: start-introspection now uses validateConnection
- Fixed PostgreSQL duplicate columns: removed cross-product JOIN in PK subquery + added Map-based deduplication in base adapter
- Fixed pk.attname reference after PK subquery refactor

## Auth UX Improvements (2026-02-06)
- ID-only credential pattern: endpoints accept { connectionId } (auth) or { connection } (no-auth) for backwards compat
- Server connection visibility: non-admins only see server connections with uploaded schema
- Schema sharing: admin-uploaded schemas visible to all assigned users
- Admin creates connection → auto-set as active → navigate to schema → auto-introspect
- Admin page loading indicator for connections list
- Reports page: added active connection selector dropdown
- Copy report to connection: new "Copy to Connection" menu item for dev/staging/prod workflows
- Migration 003: cascade-delete FK constraints on connection_schemas, saved_reports, suggestions_cache

## README & Getting Started Update (2026-02-06)
- Updated top-level README.md: added "Option 3" local auth testing quickstart with docker-compose.auth-test.yml
- Fixed npm → pnpm throughout README.md and getting-started.md
- Fixed demo database password mismatch (demo123 → demo to match docker-compose)
- Added test accounts table, container services table, demo DB connection details to README
- Added auth testing guide link to README documentation table
- Updated getting-started.md: added auth mode section, demo database section, auth env vars to table
- Added cross-references between getting-started.md and authentication-testing.md

## Documentation Audit (2026-02-05)
- Updated CLAUDE.md project structure with all current files
- Added missing API endpoints to docs (followup, enhance, revise, connection/test, rate-limit-status)
- Updated architecture overview with multi-database support
- Updated component docs with missing components (query-tab-content, followup-dialog, error-boundary, openai-api-provider, api-key-*)
- Updated models overview with missing interfaces (QueryTab, CommonTypes)
- Rewrote adding-database-support guide to reflect implemented adapter pattern
- Fixed outdated references to "PostgreSQL only" throughout docs
- Added TRUSTED_PROXIES env var documentation
- Created .memories files (completed.md, todos.md, notes.md)

## Schema UX Improvements (2026-03-04)
- Per-table AI description generation: sends one table per API request instead of batches of 10, shows table name and count in progress button
- Sample data preview: new `/api/schema/sample-data` route returns top 10 rows for a table, "Sample Data" button on each table card in schema explorer with cached data and toggle visibility

## Bug Fixes & QoL (2026-06-16)
- More helpful DB error messages: `utils/error-sanitizer.ts` now surfaces the raw driver message (naming the offending column/table/constraint) for user/query-logic errors, instead of the generic "Column not found in table". Added `detail` field to `SanitizedError` + `normalizeDbDetail()` helper. Connection/auth/unknown errors stay generic to avoid credential leaks. Added column/table-not-found patterns for SQLite and SQL Server (previously fell through to generic). Execute route passes `detail` through in the response.

## Documentation Refresh & Reorganization (2026-06-16)
- Fixed stale facts: per-endpoint `OPENAI_MODEL` defaults (generate/enhance/revise have no fallback), `npm`→`pnpm` in guides, removed non-existent `schema_{connectionId}` localStorage key.
- Closed coverage gaps: documented Admin/Landing/Auth-login pages; added missing components; new `docs/api/data-endpoints.md` (auth-mode data/admin/sharing/config/auth/connection-test); added `/api/schema/sample-data`; new `docs/architecture/auth-and-data-layer.md`.
- Restructure: split `docs/testing-plan.md` → `docs/testing/` (README + phase-1..4); split `components/features.md` → new `components/infrastructure.md`; added `docs/reference/file-map.md` (feature/route/component → source → doc) + `reference/README.md` + `guides/README.md` indexes; updated `docs/README.md` nav.
- Synced root `README.md` and `CLAUDE.md` doc tables (fixed broken testing-plan link). Verified: all docs <500 lines, all relative + anchor links resolve.
- Note: `app/auth/error`, `app/api/setup/init`, `app/setup`, `app/users` do NOT exist (code-reality audit corrected); only `app/auth/login` exists.

## Export Reports + config/reports.json (2026-06-16)
- New selective report export on Reports page: `components/export-reports-dialog.tsx` (db→reports checkbox tree, selecting a db selects all its reports, Select All/None). Button added to `app/reports/page.tsx` header. Downloads `{ version, exportDate, reports }` (source field stripped) as `reports-export-YYYY-MM-DD.json` — drop-in usable as config/reports.json.
- New shared-reports config: `config/reports.json` loaded like databases.json. `getServerReports()` in `lib/server-config.ts` (null on auth, tolerates `{reports:[]}` or bare array), new `app/api/config/reports/route.ts` (marks each `source:"server"`), `LocalStorageProvider` adds `serverReports` field, fetches `/api/config/reports` in `initialize()`, merges fresh in `getReports()` (server wins by id, never persisted to localStorage). Write methods (`saveReport`/`updateReport`) no-op on `source:"server"`.
- Server reports are read-only in UI (`components/saved-reports.tsx`): "Server Config" badge (Lock icon), Edit/Delete/favorite hidden; Clone & Copy-to-Connection still allowed (create local copies). Report `connectionId` must match a databases.json connection id to resolve.
- Added `source?: "local"|"server"` to `SavedReport` (`models/saved-report.interface.ts`). Added `config/reports.json.example` + "Shared Reports" section in `config/README.md`.
- Verified: `npm run build` clean (new route present); `/api/config/reports` returns empty when no file, loads + stamps source:server for both `{reports:[]}` and bare-array formats. Non-auth-mode only (same as databases.json).
- Note: legacy `savedReports` field inside databases.json still seeds-once (untouched for back-compat); reports.json is the always-present path.
