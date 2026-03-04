# TODO / Remaining Tasks

## High Priority
- [ ] Enhanced chart creation and customization (Roadmap item)
- [ ] Query history and favorites (Roadmap item)

## Medium Priority
- [ ] Report scheduling (Roadmap item)
- [ ] Team collaboration features (Roadmap item)
- [x] Move credentials out of localStorage for production security (done: encrypted in PostgreSQL when auth enabled)
- [x] Add proper authentication/authorization for production use (done: Authentik OIDC via Auth.js v5)
- [ ] Test Authentik integration end-to-end with a real Authentik instance
- [ ] Add connection/report sharing UI to database and reports pages

## Low Priority / Tech Debt
- [ ] Remove mock/static dashboard components (executive-metrics, performance-chart, recent-reports) once real data is used
- [ ] Add automated tests (Playwright test plan exists at docs/testing-plan.md)
- [ ] Add "composed" chart type support (currently shows unimplemented alert)
- [ ] Consider WebSocket for real-time introspection instead of polling
- [ ] Performance documentation (not yet documented)
- [ ] Deployment guide (minimal coverage in docs)

## Documentation
- [ ] Keep docs in sync as new features are added
- [ ] Prune .memories/completed.md periodically to keep file size small
