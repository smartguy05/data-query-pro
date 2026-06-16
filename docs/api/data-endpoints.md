# Auth-Mode Data, Admin & Sharing Endpoints

These endpoints back the **auth (multi-user) mode** of the app. They exist regardless of
configuration but require authentication — when auth is **disabled**, `getAuthContext()`
returns `null` and the data/admin/sharing routes respond `401 Unauthorized` (the app uses
the [localStorage provider](../architecture/state-management.md) instead).

For the AI/query/schema endpoints, see [API Overview](./overview.md).
For how credentials and auth context are resolved, see
[Auth & Data Layer](../architecture/auth-and-data-layer.md).

## Response Envelope

All routes in this group use the helpers in `lib/api/response.ts`:

```jsonc
// success
{ "success": true, "data": <payload>, "meta": { /* optional */ } }
// error
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "..." } }
```

Common statuses: `200` ok, `201` created, `400` bad request, `401` unauthorized,
`403` forbidden (admin-only), `404` not found, `500` internal error.

All routes call `getAuthContext(request)` first and return `401` when it is `null`.

---

## Data Endpoints (`/api/data/*`)

CRUD for the current user's own resources, backed by `lib/db/repositories/`.

| Method & Path | Purpose | Notes |
|---------------|---------|-------|
| `GET /api/data/connections` | List the user's connections | Includes DB-managed **server connections** (non-admins only see those with a schema uploaded) |
| `POST /api/data/connections` | Create a connection | Body requires `id`, `name`, `type`; returns `201` |
| `GET /api/data/connections/[id]` | Get one connection | |
| `PUT /api/data/connections/[id]` | Update a connection | |
| `DELETE /api/data/connections/[id]` | Delete a connection | Cascades to schemas/reports/suggestions (migration 003) |
| `POST /api/data/connections/[id]` | Duplicate a connection | |
| `GET /api/data/schemas/[connectionId]` | Get the stored schema | |
| `PUT /api/data/schemas/[connectionId]` | Save/replace the schema | |
| `GET /api/data/reports` | List the user's reports | |
| `POST /api/data/reports` | Create a report | |
| `GET /api/data/reports/[id]` | Get one report | |
| `PUT /api/data/reports/[id]` | Update a report | |
| `DELETE /api/data/reports/[id]` | Delete a report | |
| `GET /api/data/suggestions/[connectionId]` | Get cached AI suggestions | |
| `PUT /api/data/suggestions/[connectionId]` | Save AI suggestions | |
| `GET /api/data/preferences` | Get user preferences | |
| `PUT /api/data/preferences` | Update user preferences | |
| `POST /api/data/notifications/dismiss` | Dismiss a notification | |
| `POST /api/data/import-local` | Import localStorage data into the account | Used by the [DataMigrationDialog](../components/infrastructure.md#datamigrationdialog) on first login |

**Example — list connections:**
```http
GET /api/data/connections
→ 200 { "success": true, "data": [ { "id": "...", "name": "...", "type": "postgresql", ... } ] }
```

---

## Admin Endpoints (`/api/admin/*`)

Admin-only (`requireAdmin` / `auth.isAdmin`). Manage server connections shared across users.

| Method & Path | Purpose |
|---------------|---------|
| `GET /api/admin/users` | List all users |
| `GET /api/admin/server-connections` | List server connections |
| `POST /api/admin/server-connections` | Create a server connection (credentials encrypted at rest) |
| `PUT /api/admin/server-connections/[id]` | Update a server connection |
| `DELETE /api/admin/server-connections/[id]` | Delete a server connection |
| `POST /api/admin/server-connections/[id]/assign` | Assign to a user or group |
| `DELETE /api/admin/server-connections/[id]/assign` | Remove an assignment |
| `GET /api/admin/server-connections/[id]/assignments` | List assignments |

Backed by the [Admin Page](../components/pages.md#admin-page).

---

## Sharing Endpoints (`/api/sharing/*`)

Share owned resources with other users.

| Method & Path | Purpose |
|---------------|---------|
| `GET /api/sharing/connections/[id]` | List shares for a connection |
| `POST /api/sharing/connections/[id]` | Share a connection (`{ sharedWithId, permission }`) |
| `DELETE /api/sharing/connections/[id]` | Revoke a connection share |
| `GET /api/sharing/reports/[id]` | List shares for a report |
| `POST /api/sharing/reports/[id]` | Share a report |
| `DELETE /api/sharing/reports/[id]` | Revoke a report share |
| `GET /api/sharing/users/search` | Search users by email/name |

**Permissions:** connections accept `view` / `edit` / `admin`; reports accept `view` / `edit`.
Only the owner may share; sharing a resource you don't own returns `400`.
Backed by the [ShareDialog](../components/infrastructure.md#sharedialog).

---

## Config Endpoints (`/api/config/*`)

Unauthenticated, read-only configuration probes used by the client to adapt its UI.

| Method & Path | Purpose | Response |
|---------------|---------|----------|
| `GET /api/config/auth-status` | Is auth mode enabled? | `{ "authEnabled": boolean }` |
| `GET /api/config/connections` | Server-config connections from `config/databases.json` | List (read-only) |
| `GET /api/config/rate-limit-status` | Rate-limit configuration | Limit + whether BYOK is needed |

> These return a raw JSON object (not the `successResponse` envelope).

---

## Auth Endpoint

| Method & Path | Purpose |
|---------------|---------|
| `GET/POST /api/auth/[...nextauth]` | Auth.js v5 OIDC handler (sign-in, callback, session, sign-out) |

See [Auth & Data Layer](../architecture/auth-and-data-layer.md) for the OIDC flow.

---

## Connection Test

| Method & Path | Purpose |
|---------------|---------|
| `POST /api/connection/test` | Test a database connection; returns latency + server version |

Works in both modes: accepts `{ connection: {...} }` (default mode) or
`{ connectionId, source, type }` (auth mode), resolved by `validateConnection()`.
Errors are sanitized to avoid leaking credentials.

---

## Related Documentation
- [API Overview](./overview.md) - All endpoints and patterns
- [Query Endpoints](./query-endpoints.md) - SQL generation and execution
- [Schema Endpoints](./schema-endpoints.md) - Introspection and management
- [Auth & Data Layer](../architecture/auth-and-data-layer.md) - Auth, repositories, encryption
