# Authentication & Data Layer

How DataQuery Pro works in **auth (multi-user) mode**: OIDC sign-in, the PostgreSQL app
database, encrypted credentials, repositories, and how credentials are resolved for
target databases.

> Auth is **optional and off by default**. When disabled, the app uses
> [localStorage](./state-management.md) and none of this applies. For setting up a local
> OIDC test environment, see [Authentication Testing](../guides/authentication-testing.md).

## When Is Auth Enabled?

`isAuthEnabled()` (`lib/auth/config.ts`) returns true only when **all three** are set:

```
AUTH_OIDC_ISSUER
AUTH_OIDC_CLIENT_ID
AUTH_OIDC_CLIENT_SECRET
```

Auth mode additionally requires `AUTH_SECRET`, `AUTH_URL`, `APP_DATABASE_URL`, and
`APP_ENCRYPTION_KEY` (see [Getting Started](../guides/getting-started.md#environment-variables)).

## Authentication Flow (Auth.js v5 + OIDC)

- **Library:** `next-auth` v5 with a generic OIDC provider (Authentik), JWT session
  strategy (no DB sessions). Config in `lib/auth/auth-options.ts`.
- **Handler:** `app/api/auth/[...nextauth]/route.ts` exposes sign-in/callback/session/sign-out.
- **Admin detection:** from the OIDC `groups` claim, matched against `AUTH_ADMIN_GROUP`.

### `getAuthContext()`

`lib/auth/require-auth.ts` is the single entry point every API route uses:

```typescript
const auth = await getAuthContext(request);
// null when auth is disabled OR no valid token
// otherwise: { userId, email, name, isAdmin, groups }
```

- Returns `null` immediately if `isAuthEnabled()` is false (pass-through / localStorage mode).
- Otherwise decodes the JWT via `next-auth/jwt` `getToken()` using `AUTH_SECRET`.
- `requireAdmin(auth)` throws a `403` (`forbidden`) unless `auth.isAdmin` is true.

Routes that need a user return `401` when `auth` is `null` — see
[Auth-Mode Endpoints](../api/data-endpoints.md).

## Storage Abstraction

The client never talks to the DB directly. State flows through a `StorageProvider`
(`lib/storage/storage-provider.ts`), selected at runtime:

| Provider | File | Used when |
|----------|------|-----------|
| `LocalStorageProvider` | `lib/storage/local-storage-provider.ts` | Auth disabled (default) |
| `ApiStorageProvider` | `lib/storage/api-storage-provider.ts` | Auth enabled — calls `/api/data/*` |

Both implement the same interface (connections, schemas, reports, suggestions,
notifications), so [the context](./state-management.md) is unaware of the backend.

## App Database (PostgreSQL)

- **Driver/pool:** `postgres` npm package, pooled via `getAppDb()` in `lib/db/pool.ts`.
- **Migrations:** run automatically on startup from `instrumentation.ts` →
  `lib/db/migrate.ts`, applying `lib/db/migrations/*.sql` in order.

### Migrations

| File | Adds |
|------|------|
| `001_initial_schema.sql` | Core tables (below) |
| `002_server_connections.sql` | Nullable `owner_id` + `source` on `database_connections` (server connections) |
| `003_cascade_connection_deletes.sql` | `ON DELETE CASCADE` on `connection_schemas`, `saved_reports`, `suggestions_cache` |
| `004_query_accuracy.sql` | Per-user query accuracy counters (`query_accuracy_stats`) for the dashboard "% Query Accuracy" stat |
| `005_query_log.sql` | Append-only audit log (`query_log`) of every executed query — one immutable row per attempt, **no FK** (survives user deletion), **never** stores credentials |
| `006_query_corrections.sql` | Team-wide pool of learned query corrections (`query_corrections`), pooled by `schema_fingerprint`; `owner_id` is attribution-only with `ON DELETE SET NULL`, plus a dedup unique index |

### Core Tables (migration 001)

`users`, `database_connections`, `connection_schemas`, `saved_reports`,
`suggestions_cache`, `user_preferences`, `dismissed_notifications`,
`connection_shares`, `report_shares`, `server_connection_assignments`.

### Repositories

Data access lives in `lib/db/repositories/` — one module per concern (11 total). API routes
import these rather than writing SQL inline:

`user-repository`, `connection-repository`, `schema-repository`, `report-repository`,
`suggestion-repository`, `preference-repository`, `notification-repository`,
`sharing-repository`, `query-accuracy-repository`, `query-log-repository`,
`query-correction-repository`.

## Credential Encryption

Target-database passwords are encrypted at rest with **AES-256-GCM**
(`lib/db/encryption.ts`):

- Requires `APP_ENCRYPTION_KEY` (64-char hex = 32 bytes); throws on a wrong-length key.
- Stored format: `iv:authTag:ciphertext` (all hex), random 12-byte IV per value.
- `encryptPassword()` / `decryptPassword()`.

## Credential Resolution for Target Databases

When executing queries/introspection, the server never trusts client-supplied passwords
in auth mode. `validateConnection()` (`lib/database/connection-validator.ts`) resolves
the real credentials from the right source:

1. **Server connections** (`config/databases.json`) via `getServerConnectionCredentials()`.
2. **App DB connections** (auth mode) — decrypted from `database_connections`.
3. **Client-supplied** (`{ connection: {...} }`) — default mode only.

The client sends only `{ connectionId, source, type }` in auth mode; full credentials in
default mode. See [API Overview → Connection credential formats](../api/overview.md).

## Server Connections & Sharing

- **Server connections:** admin-managed, `owner_id` is null, marked `source: "server"`.
  Non-admins only see them once a schema has been uploaded. Managed from the
  [Admin Page](../components/pages.md#admin-page).
- **Sharing:** `connection_shares` / `report_shares` grant other users access
  (`view`/`edit`/`admin` for connections; `view`/`edit` for reports) via the
  [ShareDialog](../components/infrastructure.md#sharedialog).
- **First-login migration:** the [DataMigrationDialog](../components/infrastructure.md#datamigrationdialog)
  imports a user's localStorage data into their account via `/api/data/import-local`.

## Team-Wide Query Corrections Pool

In auth mode, learned query corrections (failed→revised SQL pairs) are **shared across the
whole team** rather than scoped per user. The `query_corrections` table is pooled purely by
`schema_fingerprint`, so every authenticated user querying a database with the same schema
benefits from corrections any teammate captured.

- **Repository:** `query-correction-repository.ts` — `getByFingerprint(fingerprint, limit)`
  (newest-first, LEFT JOINs `users` for author attribution), `createCorrection(userId, c)`
  (stamps `owner_id` server-side, `ON CONFLICT DO NOTHING` against the dedup index),
  `updateCorrection` / `deleteCorrection` (gated to author-or-admin).
- **Attribution:** `owner_id` references `users(id) ON DELETE SET NULL` — shared knowledge
  survives user deletion, but only the author or an admin can curate an entry.
- **Routes:** `/api/data/corrections` (`GET ?fingerprint=`, `POST`) and
  `/api/data/corrections/[id]` (`PUT`, `DELETE`).
- **Default (localStorage) mode:** the same shape is kept device-local per schema fingerprint
  — see [State Management](./state-management.md).

## Query Audit Log

Every executed query is written to an append-only audit trail via `logQuery()`
(`lib/query-log.ts`, fire-and-forget — a logging failure never breaks execution). Credentials
are **never** logged.

- **Auth / app-DB mode:** appends one immutable row to the `query_log` table (migration 005,
  no FK) via `query-log-repository.ts` (`insertLog`).
- **Default mode (no app DB):** falls back to `logs/query-log.jsonl` (`lib/query-log-file.ts`).

---

## Related Documentation
- [Architecture Overview](./overview.md) - System design and dual-mode
- [State Management](./state-management.md) - Context + StorageProvider
- [Auth-Mode Endpoints](../api/data-endpoints.md) - Data/admin/sharing routes
- [Authentication Testing](../guides/authentication-testing.md) - Local Authentik setup
