# Notes / Gotchas / Lessons Learned

> **Durable engineering gotchas now live in [docs/reference/lessons-learned.md](../docs/reference/lessons-learned.md)** —
> postgres.js (JSONB `sql.json`, UNDEFINED_VALUE, getToken secret), PostgreSQL PK
> cross-product, SQL-safety hybrid validator + read-only tx per dialect, audit-log vs
> query-history, learning-feature pool invariants, sharing `.map(toClientX)` index trap,
> Authentik 2024.12 testing, better-sqlite3/vitest, build state. Read that first.
>
> This file holds only **cross-session, project-specific** state not yet filed into docs.

## Build / Type Safety — CURRENT STATE (corrected)
- `next.config.mjs` has `typescript.ignoreBuildErrors: false` + `eslint.ignoreDuringBuilds: false`
  — `next build` enforces type-check + lint and fails on errors. Codebase is clean
  (tsc 0, lint 0/0, 138 vitest tests pass).
- `models/*.interface.ts` are proper exported modules — `import type { X } from '@/models/...'`.
  (The old global-ambient pattern that required `ignoreBuildErrors` is gone.)
- `build` is plain `next build`; use **pnpm**. If build dies on a missing
  `jest-worker/processChild.js`, run `pnpm install --force` (non-destructive).
- (Any note claiming `ignoreBuildErrors: true` or a destructive rimraf build script is
  STALE — that was fixed 2026-06-18.)

## Quick Architecture Reminders
- Adapter factory: `DatabaseAdapterFactory.create(type)` (registry pattern, `lib/database/factory.ts`).
- Storage abstraction: `LocalStorageProvider` (auth off, localStorage) / `ApiStorageProvider`
  (auth on, `/api/data/*`). Mode determined at startup via `/api/config/auth-status`.
- All OpenAI routes check rate limits first + accept `x-user-openai-key`.
- All API routes call `getAuthContext(request)` → null when auth disabled (pass-through).
- Server connections (config/databases.json): passwords stripped before client; server-side
  uses `getServerConnectionCredentials()`. `owner_id` nullable (migration 002).

## Environment (this dev machine)
- **better-sqlite3 native binding may be missing** after pnpm install (build scripts not run).
  Symptom: `Could not locate the bindings file`. Fix: `cd node_modules/better-sqlite3 && npx prebuild-install`
  (downloads the prebuilt .node; `pnpm rebuild better-sqlite3` alone did NOT produce it).
- **Orphaned dev server**: stopping a background `npm run dev` can leave the node child holding
  port 3000 (next `npm run dev` silently moves to 3001). Check `Get-NetTCPConnection -LocalPort 3000`
  and kill the owning PID. Also: running `next build` deletes/replaces `.next` under a live dev
  server → all `_next/static` chunks 404; restart dev with a fresh `.next`.

## node-sql-parser AST gotcha (v5.4, pinned by tests/unit/sql-limit.test.ts)
- For `A UNION B LIMIT 10`, the parser puts `limit` on the **last** node of the `_next` chain,
  not the root statement — existing-limit detection must walk `_next`.

## Process
- `.memories/` tracks cross-session state — update `completed.md`/`todos.md`/`notes.md` after tasks.
- When adding files/features, also update the CLAUDE.md structure tree + relevant `docs/`.

## Nested-button hydration error (fixed 2026-07-14)
- React 19 logs "In HTML, <button> cannot be a descendant of <button>... hydration error"
  once per offending element. Cause: the follow-up tab close "X" was a raw `<button>` inside
  Radix `TabsTrigger` (itself a `<button>`) in `app/query/page.tsx`.
- Fix: use `<span role="button" tabIndex={0}>` with onClick + Enter/Space onKeyDown instead.
  Rule: never put a button/Button inside TabsTrigger, SelectTrigger, or any Radix trigger
  without `asChild` -- they all render `<button>`.

## Duplicate React key = duplicate connection id (fixed 2026-07-14)
- "Encountered two children with the same key `<epoch ms>`" across many pages meant the
  connections array had the same id twice: `config/databases.json` was exported FROM
  localStorage, so the same connection existed as both a server connection and a local one,
  and `LocalStorageProvider.getConnections()` concatenated them without dedup.
- Fix: getConnections now filters local connections whose id exists in serverConnections
  (server wins), mirroring getSchemas/getReports. Connection ids are bare Date.now() strings.
