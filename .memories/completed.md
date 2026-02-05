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
