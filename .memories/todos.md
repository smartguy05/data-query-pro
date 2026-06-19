# TODO / Remaining Tasks

## Open
- [ ] **End-to-end auth-mode verification** against a real Authentik instance. Biggest open
      risk: two shipped features are unverified against live infra — connection/report
      **sharing** (share view → "Shared with you" w/ disabled Edit/Delete; upgrade to edit;
      remove) and **team-wide corrections** repo SQL (dedup, author-or-admin scoping). Fold
      both into this pass. Infra exists: `docker-compose.auth-test.yml` + `scripts/setup-authentik.sh`.
- [ ] **Playwright E2E tests** from the `docs/testing/` plan — manual plan exists, nothing
      automated. (Unit/component layer is done: Vitest + Testing Library, 138 tests.)
- [ ] Prune `.memories/completed.md` periodically to keep it small.

## Deferred (intentional, with rationale)
- [~] WebSocket for real-time introspection — DEFERRED. App Router has no native WS handlers;
      needs a custom server that breaks `next start`/standalone. Polling (2000ms) kept; SSE is
      the lighter future option. See `docs/guides/performance.md`.

## Done (roadmap + major items — detail in completed.md)
- [x] Team collaboration (corrections + sharing + admin assignment + schema sharing) — 2026-06-19
- [x] Connection/report sharing UI — 2026-06-19
- [x] Learning feature Phase 2 (team-wide corrections) — 2026-06-18
- [x] Query accuracy stat; dashboard widgets (pin reports as KPIs/charts); query history;
      enhanced chart customizer; composed chart type — 2026-06-18
- [x] Credentials encrypted at rest (Postgres, auth mode) + Authentik OIDC authz
- [x] Type-safety refactor (models → exported modules, tsc 0) + ESLint setup + Vitest harness
- [x] Performance + deployment guides; docs sync
