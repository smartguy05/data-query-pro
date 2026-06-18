# TODO / Remaining Tasks

## High Priority
- [ ] Enhanced chart creation and customization (Roadmap item)
- [x] Query history and favorites (Roadmap item) — favorites already done; query history added 2026-06-18 (device-local, /history page)

## Medium Priority
- [ ] Report scheduling (Roadmap item)
- [ ] Team collaboration features (Roadmap item)
- [x] Move credentials out of localStorage for production security (done: encrypted in PostgreSQL when auth enabled)
- [x] Add proper authentication/authorization for production use (done: Authentik OIDC via Auth.js v5)
- [ ] Test Authentik integration end-to-end with a real Authentik instance
- [ ] Add connection/report sharing UI to database and reports pages

## Low Priority / Tech Debt
- [~] Remove mock/static dashboard components: recent-reports, scheduled-reports, report-templates DELETED 2026-06-18. executive-metrics + performance-chart LEFT IN PLACE (carded in Claude Design system: .design-sync/config.json + previews + ds-bundle). To remove later: drop from config.json componentSrcMap, delete previews + ds-bundle dirs, re-run /design-sync.
- [ ] Add automated tests (Playwright test plan at docs/testing/)
- [ ] Add "composed" chart type support (currently shows unimplemented alert)
- [ ] Consider WebSocket for real-time introspection instead of polling
- [ ] Performance documentation (not yet documented)
- [ ] Deployment guide (minimal coverage in docs)

## Documentation
- [ ] Keep docs in sync as new features are added
- [ ] Prune .memories/completed.md periodically to keep file size small
