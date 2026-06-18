# TODO / Remaining Tasks

## High Priority
- [x] Enhanced chart creation and customization (Roadmap item) — implemented 2026-06-18 (ChartCustomizer: type/columns/labels/toggles/colors + manual build; persisted to SavedReport.visualization; dashboard uses it)
- [x] Query history and favorites (Roadmap item) — favorites already done; query history added 2026-06-18 (device-local, /history page)
- [x] Dashboard widgets: pin saved reports as KPIs (ExecutiveMetrics) / trend charts (PerformanceChart) — wired into app/page.tsx State 5, real data via /api/query/execute, 2026-06-18
- [x] Query accuracy stat — implemented 2026-06-18 (global per-user; counts AI-generated + follow-up executions, every attempt; thumbs override either direction; local + synced-when-auth via StorageProvider; migration 004 + query-accuracy-repository + /api/data/query-accuracy; dashboard card hidden < 5 queries)

## Medium Priority
- [ ] Report scheduling (Roadmap item)
- [ ] Team collaboration features (Roadmap item)
- [x] Move credentials out of localStorage for production security (done: encrypted in PostgreSQL when auth enabled)
- [x] Add proper authentication/authorization for production use (done: Authentik OIDC via Auth.js v5)
- [ ] Test Authentik integration end-to-end with a real Authentik instance
- [ ] Add connection/report sharing UI to database and reports pages

## Tech Debt — Type Safety
- [x] **Group C model-types refactor DONE 2026-06-18**: converted all `models/*.interface.ts` to proper exported modules (`export interface`), added internal cross-imports (database-table→column, schema→database-table, database-context-type→connection/schema/report/history), and added `import type` statements across ~22 usage files (storage/*, repositories, server-config, schema routes, database/query pages, schema-explorer, compare-schemas/copy-descriptions utils + test). `tsc --noEmit` now 0 errors (was 85). The global-ambient pattern is gone — model types are now explicitly imported everywhere.
- [x] Group A+B pre-existing issues fixed 2026-06-18: 9 react-hooks/exhaustive-deps warnings (documented eslint-disable directives), ~20 localized type errors (NextRequest.ip→x-real-ip, es2018 via tsconfig target ES2020, JSONValue casts in repositories, Session casts, implicit-any params, postgres typing). `npm run lint` = 0 errors/0 warnings; `npm run test` = 86 pass.

## Low Priority / Tech Debt
- [x] Mock/static dashboard components resolved: recent-reports, scheduled-reports, report-templates DELETED 2026-06-18. executive-metrics + performance-chart are NO LONGER mocks — wired to real pinned-report data 2026-06-18 (see completed.md "Dashboard Widgets"). Both are now prop-driven; design-sync previews still card them. If previews break after the prop change, re-run /design-sync to regenerate previews.
- [~] Add automated tests — Vitest + Testing Library unit/component tests added 2026-06-18 (86 tests: metric-status, substitute-params, error-sanitizer, compare-schemas, reshape-chart-config, ExecutiveMetrics, ChartCustomizer). Playwright E2E (docs/testing/ plan) still NOT implemented.
- [x] Add "composed" chart type support — implemented 2026-06-18 (mixed bars/lines/areas via Recharts ComposedChart; AI tool + UI menu + dashboard widget all wired)
- [x] WebSocket for real-time introspection — DEFERRED 2026-06-18. Rationale documented in docs/guides/performance.md (App Router has no native WS handlers; needs custom server, breaks next start/standalone; SSE is lighter future option). Polling (2000ms) kept intentionally.
- [x] Performance documentation — docs/guides/performance.md created 2026-06-18
- [x] Deployment guide — docs/guides/deployment.md created 2026-06-18 (Docker self-host)

## Documentation
- [x] Keep docs in sync — docs-sync pass 2026-06-18 (features.md/overview.md/file-map.md updated for dashboard widgets, composed chart, chart customizer; fixed stale QueryResultsDisplay props block)
- [ ] Implement Playwright E2E tests from docs/testing/ plan (manual plan exists; not automated)
- [ ] Prune .memories/completed.md periodically to keep file size small
