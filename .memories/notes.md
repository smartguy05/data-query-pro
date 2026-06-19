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

## Process
- `.memories/` tracks cross-session state — update `completed.md`/`todos.md`/`notes.md` after tasks.
- When adding files/features, also update the CLAUDE.md structure tree + relevant `docs/`.
