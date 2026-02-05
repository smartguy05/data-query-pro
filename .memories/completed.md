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
