# Completed Tasks

> Recent (current branch) work is detailed below. Older work is collapsed under
> **Historical (summarized)** — for full prose, see git history. Durable gotchas live in
> [docs/reference/lessons-learned.md](../docs/reference/lessons-learned.md).

## Nav consolidation + Admin/Profile relocation + real Profile page (2026-06-19, branch more-improvements)
- Crowded top nav (7 flat links) reduced to 3 top-level items. New shape: **Dashboard** (standalone) + **Data ▾** (Database, Schema) + **Query ▾** (Query, History, Learning, Reports).
- Replaced flat `navigation` array with `standaloneLinks` + `navGroups` (+ `NavGroup` type) in `components/navigation.tsx`. Desktop uses Radix `DropdownMenu` (already imported for user menu); parent highlights via `isGroupActive(group)`. Added `ChevronDown` icon. Mobile keeps flat expanded list with uppercase group-label headers.
- **Admin** moved out of the top nav into the profile dropdown (between Profile and Sign out), gated on `isAdmin`. Same on mobile (in the user section).
- **Profile link was dead** — it pointed at `/admin` (Admin Panel, which redirects non-admins to `/`); there was no profile route. Built a real `app/profile/page.tsx`: account card (avatar/name/email/admin badge/groups from `useAuth`, with a "Local mode" fallback when auth disabled) + Usage stats (query accuracy %, connections, reports counts from `useDatabaseOptions`) + Admin Panel / Sign out actions. Nav "Profile" now → `/profile` (desktop + mobile; added Profile to mobile too). Guards: in auth mode redirects to `/` if not authenticated.
- Verified: `npm run lint` 0/0, `npm run build` passes (route `/profile` 4.73 kB).

## Import Reports (2026-06-19, branch more-improvements)
- Closed a gap: Reports page had **Export** (`export-reports-dialog.tsx`, emits `{version,exportDate,reports[]}`) but **no import**. The only importer was the Database page's `importData`, which rejects any file lacking `databaseConnections` AND writes straight to localStorage (broken in auth mode).
- New `components/import-reports-dialog.tsx` + "Import Reports" button on `app/reports/page.tsx`. File picker → parse (accepts `{reports}`, bare array, or `{savedReports}`) → classify each report: **duplicate** (id already in context.reports → skipped, idempotent), **auto** (original `connectionId` exists → imports there), **orphan** (connection missing → per-report connection `Select`, unassigned orphans skipped). Imports via context `saveReport` so it works in BOTH localStorage and auth modes. Strips `source`/`accessLevel`/`sharedBy*` on import. Toast summarizes imported + skipped counts.
- Decisions (user): auto-assign original connection else per-report choice; skip-by-id for duplicates.
- Verified: `pnpm lint` 0/0, `pnpm build` passes.

## Connection & Report Sharing UI (2026-06-19, branch more-improvements)
- Surfaced the already-built sharing backend in the UI (it had none). Scope: connections +
  reports. Permissions **View/Edit only** (admin dropped from UI), default view, owner can
  grant edit. Presentation: separate "Your X" / "Shared with you" sections. View-only
  recipients see Edit/Delete **shown-but-disabled** w/ tooltips. All gated on `authEnabled`.
  No new migration (tables exist in 001).
- Models: added optional `accessLevel?: "owner"|"view"|"edit"`, `sharedByEmail?`,
  `sharedByName?` to `DatabaseConnection` + `SavedReport` (`undefined` ⇒ owned).
- Repos: `getConnectionsForUser`/`getReportsForUser` tag owned rows `'owner'`, shared rows by
  `permission`, and `LEFT JOIN users` on `owner_id` for "Shared by …". `toClientConnection`/
  `toClientReport` gained an `accessLevel` 2nd arg — **callers using `.map(toClientX)` must
  wrap `.map(r => toClientX(r))`** (index leak broke the build once).
- `ShareDialog`: controlled mode (`open`/`onOpenChange`) + custom `trigger` prop; reports open
  it from a dropdown via controlled state, connections via inline trigger. Per-share permission
  `Select` (view↔edit upsert), success/error toasts (was silently swallowing).
- UI: `app/database/page.tsx` + `components/saved-reports.tsx` extracted `renderConnectionCard`/
  `renderReportCard`, partition owned/shared, two titled sections when `authEnabled &&
  shared.length>0`. Owner-only Share; `canEdit = !server && (!shared || accessLevel==='edit')`;
  delete/pin/favorite owner-only; purple "Shared by {name} · View/Edit" badge.
- Verified: `pnpm lint` 0/0, `pnpm build` passes, 138 vitest tests pass. Sharing routes/repo
  SQL NOT unit-tested (need live Postgres + auth) — verify via manual e2e in auth mode.

## Learning Feature Phase 2 — team-wide corrections sync (2026-06-18, branch more-improvements)
- Captured failed→revised corrections now shared across a team in auth mode (Phase 1 was
  device-local). Decisions: corrections only (examples/history stay device-local), team-wide
  pool keyed purely by schema fingerprint, author-or-admin edit/delete, capture-only, curation page.
- Migration `006_query_corrections.sql`: pooled by `schema_fingerprint` (NOT per-user).
  `owner_id ... ON DELETE SET NULL` (attribution only). Indexes `(fingerprint, created_at DESC)`
  + dedup unique `(fingerprint, md5(bad_sql), md5(good_sql))`.
- Repo `query-correction-repository.ts`: `getByFingerprint` (no owner filter, LEFT JOIN users),
  `createCorrection` (`INSERT ... ON CONFLICT DO NOTHING`), `update`/`delete` gated
  `WHERE id=$ AND (owner_id=$user OR $isAdmin)`.
- API `/api/data/corrections` (GET `?fingerprint=`, POST) + `[id]` (PUT, DELETE). Added 4
  methods to `StorageProvider` (corrections previously bypassed it); context exposes
  `recordQueryCorrection`/`getCorrectionsForFingerprint`/`update`/`delete` (fire-and-forget).
- Curation page `app/learning/page.tsx` (+ nav "Learning"): list/search/edit/delete for current
  connection's fingerprint; `canManage = !authEnabled || isAdmin || ownerId===user.id` (server
  enforces too). `QueryCorrection` gained `ownerId`/`ownerName`/`updatedAt`; `CORRECTIONS.MAX_POOL_FETCH=200`.
- Verified: tsc 0, lint 0/0, build passes, 138 tests (new `query-corrections-storage.test.ts`).
  Repo SQL not unit-tested (needs live DB).

## Query Safety, Auditing & Learning (2026-06-18, branch more-improvements)
- **Read-only execution**: `AdapterConnectionConfig.readOnly` flag set in `/api/query/execute`
  + `/api/schema/sample-data`. Per-dialect enforcement (PG RO tx, MySQL RO tx+ROLLBACK, SQL
  Server wrap+always-ROLLBACK, SQLite connect-time readonly). Introspection stays writable.
- **AST validator** `lib/database/sql-validator.ts` `validateReadOnlySql(sql,dbType)` replaced
  the regex blocklist — `node-sql-parser` (dep ^5.4.0), single `select` only, hybrid fallback
  to `heuristicReadOnly()` when astify throws. Removed dead `DANGEROUS_SQL_KEYWORDS`.
- **Audit log** `lib/query-log.ts` `logQuery()` (fire-and-forget): app DB `query_log`
  (migration 005, no FK) when `isAppDbEnabled()` else `logs/query-log.jsonl`. Never logs creds.
- **Learn from previous queries** (per-user few-shot + avoid-mistakes, device-local, per schema
  fingerprint): `utils/schema-fingerprint.ts`, `utils/example-relevance.ts`,
  `utils/query-corrections.ts`. Client `buildLearningContext` → `/api/query/generate`; server
  `buildLearningSections()` injects two guarded prompt sections. Constants `AI.MAX_FEW_SHOT=4`,
  `AI.MAX_CORRECTIONS=2`, `CORRECTIONS.MAX_ENTRIES=50`.
- Verified: tsc clean, lint 0/0, build passes, 123 tests at the time (new: sql-validator,
  schema-fingerprint, example-relevance, query-log-no-credentials). Not live-DB tested.
- (Full SQL-safety/learning gotchas → docs/reference/lessons-learned.md.)

## Team Collaboration (Roadmap item) — COMPLETE (2026-06-19)
- Delivered across: team-wide shared **query corrections** (Learning Phase 2, auth mode) +
  **connection/report sharing** (view/edit, owner-curated) + **admin server-connection
  assignment** to users/groups + **schema sharing** (admin uploads visible to assigned users).
  Considered complete per user decision 2026-06-19.

---

## Historical (summarized)

### Core feature set (complete)
Multi-DB (PostgreSQL/MySQL/SQL Server/SQLite via adapter pattern); NL→SQL via OpenAI Responses
API; query enhance / self-correct-revise / follow-ups; schema introspection (background + poll)
with AI table/column descriptions + change detection; column type auto-detect + manual override;
multi-tab query UI; saved reports w/ `{{param}}` params, favorites, clone, import/export;
AI metric/report suggestions; charts (bar/line/pie/area/scatter/composed) via Recharts;
dashboard widgets (pin reports as KPIs / trend charts, live execution); query accuracy stat;
chart customizer; query history (device-local); dark/light theme; server config via
`config/databases.json` + shared reports via `config/reports.json`; rate limiting + BYOK;
CSRF; error boundary; landing page; real connection testing; data export/import.

### Auth & multi-user (2026-02-05 → 06)
Optional Authentik OIDC via Auth.js v5 (JWT, no DB sessions); dual-mode storage
(localStorage / PostgreSQL); `StorageProvider` abstraction; auto-migration via
`instrumentation.ts`; AES-256-GCM credential encryption; 10 PG tables + 8 repositories;
`/api/data/*`, `/api/sharing/*`, `/api/admin/*` routes; `getAuthContext` on all routes;
credential resolution from app DB; login page; nav user menu; admin panel (server-connection
assignment); data-migration dialog; `useAuth` hook. Auth testing infra:
`docker-compose.auth-test.yml` + `scripts/setup-authentik.sh` + `docs/guides/authentication-testing.md`.
Bug fixes: migration dialog gating, pre-session API calls, getToken secret, JWT retry, JSONB
double-serialization, migration idempotency/FK guards, ContentLoadingGate, PG PK cross-product.

### Testing / tooling / docs (2026-06-18)
Vitest + Testing Library harness (`vitest.config.ts`, jsdom, `@/` alias); ESLint
(`.eslintrc.json` next/core-web-vitals). **Group C type refactor**: all `models/*.interface.ts`
→ exported modules + `import type` at ~22 sites; tsc 0 (was 85); next.config flipped to enforce
type-check + lint; build script de-fanged to plain `next build`. Guides added: performance,
deployment. Playwright E2E (docs/testing/) still NOT implemented.

### Other features (2026-03 → 2026-06)
Per-table AI descriptions + sample-data preview (`/api/schema/sample-data`); copy schema
descriptions between connections (`utils/copy-descriptions.ts` + dialog, client-only);
composed chart type; enhanced chart customizer (`components/chart-customizer.tsx`,
`SavedReport.visualization`); dashboard remove-widget control; export-reports dialog +
`config/reports.json` shared reports (read-only, "Server Config" badge); error-sanitizer
`detail` field (raw DB message for query-logic errors); doc refresh/reorg (split testing-plan
→ docs/testing/, added file-map, data-endpoints, auth-and-data-layer).
