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

### Core Tables (migration 001)

`users`, `database_connections`, `connection_schemas`, `saved_reports`,
`suggestions_cache`, `user_preferences`, `dismissed_notifications`,
`connection_shares`, `report_shares`, `server_connection_assignments`.

### Repositories

Data access lives in `lib/db/repositories/` — one module per concern. API routes import
these rather than writing SQL inline:

`user-repository`, `connection-repository`, `schema-repository`, `report-repository`,
`suggestion-repository`, `preference-repository`, `notification-repository`,
`sharing-repository`.

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

---

## Related Documentation
- [Architecture Overview](./overview.md) - System design and dual-mode
- [State Management](./state-management.md) - Context + StorageProvider
- [Auth-Mode Endpoints](../api/data-endpoints.md) - Data/admin/sharing routes
- [Authentication Testing](../guides/authentication-testing.md) - Local Authentik setup
