# TODO / Remaining Tasks

## Open — cancellation / dirty reads (added 2026-08-12)
- [ ] **Manual verification still outstanding.** Neither driver-level cancellation nor
      isolation behavior can be unit-tested (mocking would test the mock), so these are
      the only assertions that prove the features work:
      1. Long query per engine (PG `SELECT pg_sleep(60)`, MySQL `SELECT SLEEP(60)`; for
         SQL Server use a slow cross join — `WAITFOR DELAY` won't survive the SELECT-only
         validator). Click Cancel, then confirm **server-side** the query is gone via
         `pg_stat_activity` / `SHOW PROCESSLIST` / `sys.dm_exec_requests`. A UI returning
         to idle proves nothing — that's exactly what a client-only abort looks like.
      2. Confirm the Query Accuracy stat does **not** move across a cancel.
      3. Confirm the audit row: `success = false`, `error = 'Query cancelled by user'`.
      4. Dirty reads on SQL Server: session A `BEGIN TRAN; UPDATE t SET x=999 WHERE id=1;`
         (no commit). Toggle off → app query hangs on the lock. Toggle on → returns 999
         immediately. Rollback A, re-run → 999 gone. MySQL: same setup but verify by
         *value* (InnoDB takes no read locks at READ COMMITTED).
      5. PG/SQLite: toggle on → `dirtyReadApplied: false` and results identical to off.
      6. SQLite: Cancel button hidden; a forced cancel returns `not_cancellable`.
- [ ] **Verify empirically whether Next 15's `request.signal` fires on client disconnect**
      in `next dev`, `next start`, and behind the reverse proxy. The cancel POST is the
      primary path precisely because this is unverified; if the signal does fire reliably,
      abort-on-unmount coverage is stronger than currently assumed.
- [ ] Dashboard widgets (`app/page.tsx` `runSql`) send neither `defaultLimit` nor
      `dirtyRead` — deliberate for v1 (pinned KPIs must not show uncommitted numbers), but
      it means the same saved report can return different numbers on the dashboard vs the
      query page. Decide whether to unify.
- [ ] `dirtyReadApplied` is derived from `supportsDirtyRead(dbType)`, i.e. "requested on a
      supporting engine" — NOT server-confirmed. Because the MySQL `SET` fails open, a
      permission-restricted MySQL could report `true` while running at the default level.
      Closing the gap needs a `dirtyReadActive` flag on `IDatabaseAdapter`.
- [ ] Audit log has no dedicated cancelled state — uses `success:false` + the
      `CANCELLED_LOG_MESSAGE` sentinel. A real `cancelled` column needs a migration.
- [ ] The query registry is **process-local**: behind multiple Next instances or on
      serverless, a cancel can land on the wrong instance and report `already_finished`
      while the query runs on. Migration path if needed: persist
      `{queryId -> pid, engine}` in the app DB — the kills are plain out-of-band SQL, so
      any instance could run them.
- [ ] `hooks/use-schema-loading.ts` is **unused dead code** — `schema-explorer.tsx` has its
      own inline `processId`/`isProcessing` polling instead. Both were given the `cancelled`
      status handling and a `cancelIntrospection`, but the duplication should be collapsed
      (either adopt the hook in schema-explorer or delete the hook).
- [ ] Consider a shorter `connect_timeout` for `/api/connection/test` (postgres.js defaults
      to 30s, too long for a UI test button). Cancellation is the wrong tool there: the
      failure mode is a hanging *connect*, which isn't cancellable.

## Open
- [ ] Surface the new per-trial `retries` count in the HTML report — retried trials sum
      billing across attempts, so cost cells silently mix single- and double-billed trials.
- [ ] Second Ctrl+C during eval cleanup re-awaits the same in-flight promise — a hung
      OpenAI delete blocks exit. Consider hard-exit (or container-stop-first) on 2nd signal.
- [ ] `CONNECTION_INVALID` 400s from execute bucket as `execution-error` (model-failure
      bucket) — arguably needs a harness-error FailureClass in evals/types.ts.
- [ ] **Run the 4-model eval sweep** once 5.6 API access is confirmed:
      `pnpm eval -- --models gpt-5.4,gpt-5.6-luna,gpt-5.6-terra,gpt-5.6-sol --trials 3`
      (needs: dev server up, `dataquery-demo-db` container running + freshly reseeded so
      date-relative goldens have data, EVAL_ALLOW_MODEL_OVERRIDE=true). gpt-5.4 baseline
      DONE 2026-08-07: 95/96 (99.0%), median gen 5.4s — run-2026-08-07T20-38-41-622Z.
- [ ] Consider a CI smoke eval (3 questions × 1 trial) to catch prompt/schema regressions.
- [ ] **Fill in `evals/pricing.json` rates** — committed with nulls, so cost shows "—"
      until real $/1M input+output rates are added per model.
- [ ] **Investigate zero prompt caching**: eval runs show `cachedInputTokens: 0` even
      though every call resends the same ~18K-token schema prompt. Input tokens are
      ~130x output, so caching is by far the biggest available cost lever for the app —
      much bigger than model or effort choice. Check whether file_search/vector-store
      requests are cacheable and whether prompt ordering blocks it.
- [ ] **Confirm the reasoning-effort finding with a real run** (probe was only 4 calls):
      `pnpm eval -- --models "gpt-5.4,gpt-5.6-sol" --efforts "low,high" --trials 3`
      (~192 calls). If sol@low matches gpt-5.4 on accuracy at comparable speed,
      set OPENAI_REASONING_EFFORT accordingly. Note the eval question set currently
      SATURATES (31/32 for multiple models = statistical noise) — accuracy can't
      discriminate top models; harder questions (window functions, nested
      aggregations, self-joins) are needed for that.
- [ ] Consider `service_tier: 'fast'` and `text.verbosity` as additional latency
      knobs (both exist on the Responses API, neither is wired up).
- [ ] Decide whether OPENAI_REASONING_EFFORT should apply to the other 6 OpenAI
      routes (currently generate-only) — low effort may help SQL but hurt
      description/suggestion quality.
- [ ] **Schema introspection excludes views** (found by the eval): `postgresql.queries.ts`
      reads `pg_catalog.pg_tables` only, so views (e.g. demo `monthly_revenue`,
      `customer_health`) never reach the OpenAI schema file — NL questions about views
      can't be answered. Consider adding views (flagged as such) to introspection.
- [ ] **Schema file has no example values** (found by the eval): status/priority literals
      like 'in_progress' or 'Critical' are undiscoverable, so the model coin-flips casing
      and separators. Consider sampling distinct values for low-cardinality text columns
      into the schema upload.
- [ ] **End-to-end auth-mode verification** against a real Authentik instance. Biggest open
      risk: two shipped features are unverified against live infra — connection/report
      **sharing** (share view → "Shared with you" w/ disabled Edit/Delete; upgrade to edit;
      remove) and **team-wide corrections** repo SQL (dedup, author-or-admin scoping). Fold
      both into this pass. Infra exists: `docker-compose.auth-test.yml` + `scripts/setup-authentik.sh`.
- [ ] **Playwright E2E tests** from the `docs/testing/` plan — manual plan exists, nothing
      automated. (Unit/component layer is done: Vitest + Testing Library, 138 tests.)
- [ ] **No DB-integration test layer.** The `query_accuracy` 42804 bug (fixed 2026-08-12)
      could not have been caught by the current suite: every test in `tests/unit` is a pure
      function with no database. Any bug living in SQL text or in postgres.js parameter typing
      is invisible to CI. Consider a small integration tier against the compose Postgres, or at
      minimum a smoke test per repository.
- [ ] **Entra ID: validate against a real tenant.** The provider-neutral OIDC work
      (2026-08-12) is verified against Authentik and by simulating the Entra *shape* locally,
      but no real Entra token has ever been decoded. Confirm which of
      `email`/`preferred_username` is populated, whether `groups` holds GUIDs, and whether
      `roles` appears. See `docs/guides/azure-entra-setup.md` §4.
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
