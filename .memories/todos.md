# TODO / Remaining Tasks

## High Priority
- [ ] Enhanced chart creation and customization (Roadmap item)
- [x] Query history and favorites (Roadmap item) — favorites already done; query history added 2026-06-18 (device-local, /history page)
- [x] Dashboard widgets: pin saved reports as KPIs (ExecutiveMetrics) / trend charts (PerformanceChart) — wired into app/page.tsx State 5, real data via /api/query/execute, 2026-06-18

## Medium Priority
- [ ] Report scheduling (Roadmap item)
- [ ] Team collaboration features (Roadmap item)
- [x] Move credentials out of localStorage for production security (done: encrypted in PostgreSQL when auth enabled)
- [x] Add proper authentication/authorization for production use (done: Authentik OIDC via Auth.js v5)
- [ ] Test Authentik integration end-to-end with a real Authentik instance
- [ ] Add connection/report sharing UI to database and reports pages

## Low Priority / Tech Debt
- [x] Mock/static dashboard components resolved: recent-reports, scheduled-reports, report-templates DELETED 2026-06-18. executive-metrics + performance-chart are NO LONGER mocks — wired to real pinned-report data 2026-06-18 (see completed.md "Dashboard Widgets"). Both are now prop-driven; design-sync previews still card them. If previews break after the prop change, re-run /design-sync to regenerate previews.
- [ ] Add automated tests (Playwright test plan at docs/testing/)
- [x] Add "composed" chart type support — implemented 2026-06-18 (mixed bars/lines/areas via Recharts ComposedChart; AI tool + UI menu + dashboard widget all wired)
- [ ] Consider WebSocket for real-time introspection instead of polling
- [ ] Performance documentation (not yet documented)
- [ ] Deployment guide (minimal coverage in docs)

## Documentation
- [ ] Keep docs in sync as new features are added
- [ ] Prune .memories/completed.md periodically to keep file size small
