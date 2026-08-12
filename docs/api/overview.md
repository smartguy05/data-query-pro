# API Overview

DataQuery Pro uses Next.js API routes for server-side operations. All routes are in `app/api/`.

## Endpoint Summary

### Core Endpoints (both modes)
| Endpoint | Method | Purpose | Documentation |
|----------|--------|---------|---------------|
| `/api/query/generate` | POST | Convert natural language to SQL | [Query Endpoints](./query-endpoints.md) |
| `/api/query/execute` | POST | Execute SQL on database | [Query Endpoints](./query-endpoints.md) |
| `/api/query/enhance` | POST | Enhance vague queries with AI | [Query Endpoints](./query-endpoints.md) |
| `/api/query/followup` | POST | Generate follow-up queries | [Query Endpoints](./query-endpoints.md) |
| `/api/query/revise` | POST | Revise failed queries | [Query Endpoints](./query-endpoints.md) |
| `/api/schema/introspect` | GET/POST | Database schema introspection | [Schema Endpoints](./schema-endpoints.md) |
| `/api/schema/upload-schema` | POST | Upload schema to OpenAI | [Schema Endpoints](./schema-endpoints.md) |
| `/api/schema/generate-descriptions` | POST | Generate AI descriptions | [Schema Endpoints](./schema-endpoints.md) |
| `/api/schema/update-description` | POST | Update single description | [Schema Endpoints](./schema-endpoints.md) |
| `/api/schema/start-introspection` | POST | Start background introspection | [Schema Endpoints](./schema-endpoints.md) |
| `/api/schema/status` | GET | Poll introspection status | [Schema Endpoints](./schema-endpoints.md) |
| `/api/schema/sample-data` | POST | Fetch first 10 rows of a table (data preview) | [Schema Endpoints](./schema-endpoints.md) |
| `/api/dashboard/suggestions` | POST | Generate metric suggestions | [Dashboard Endpoints](./dashboard-endpoints.md) |
| `/api/chart/generate` | POST | Generate chart config | [Dashboard Endpoints](./dashboard-endpoints.md) |
| `/api/connection/test` | POST | Test database connectivity | [Data Endpoints](./data-endpoints.md#connection-test) |
| `/api/config/connections` | GET | Get server-configured connections | [Data Endpoints](./data-endpoints.md#config-endpoints-apiconfig) |
| `/api/config/reports` | GET | Get server-configured shared reports | [Data Endpoints](./data-endpoints.md#config-endpoints-apiconfig) |
| `/api/config/rate-limit-status` | GET | Check rate limit status | [Data Endpoints](./data-endpoints.md#config-endpoints-apiconfig) |
| `/api/config/auth-status` | GET | Check if auth is enabled | [Data Endpoints](./data-endpoints.md#config-endpoints-apiconfig) |
| `/api/auth/[...nextauth]` | GET/POST | Auth.js v5 OIDC handler | [Data Endpoints](./data-endpoints.md#auth-endpoint) |

### Authenticated CRUD Endpoints (auth mode only)

> Full request/response details: [Auth-Mode Data, Admin & Sharing Endpoints](./data-endpoints.md).
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/data/connections` | GET, POST | List/create user connections |
| `/api/data/connections/[id]` | GET, PUT, DELETE, POST | CRUD + duplicate connection |
| `/api/data/schemas/[connectionId]` | GET, PUT | Get/update schema for connection |
| `/api/data/reports` | GET, POST | List/create reports |
| `/api/data/reports/[id]` | GET, PUT, DELETE | CRUD for individual report |
| `/api/data/suggestions/[connectionId]` | GET, PUT | Get/update cached suggestions |
| `/api/data/query-accuracy` | GET, PUT | Get/update per-user query accuracy counters |
| `/api/data/corrections` | GET, POST | List (by `?fingerprint=`)/create team-wide query corrections |
| `/api/data/corrections/[id]` | PUT, DELETE | Update/delete a query correction (owner or admin) |
| `/api/data/preferences` | GET, PUT | User preferences |
| `/api/data/notifications/dismiss` | POST | Dismiss notification |
| `/api/data/import-local` | POST | Import localStorage data |

### Admin Endpoints (admin only)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/users` | GET | List all users |
| `/api/admin/server-connections` | GET, POST | List/create server connections |
| `/api/admin/server-connections/[id]` | PUT, DELETE | Update/delete server connection |
| `/api/admin/server-connections/[id]/assign` | POST, DELETE | Assign/unassign user or group |
| `/api/admin/server-connections/[id]/assignments` | GET | List assignments |

### Sharing Endpoints (auth mode only)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sharing/connections/[id]` | GET, POST, DELETE | Manage connection shares |
| `/api/sharing/reports/[id]` | GET, POST, DELETE | Manage report shares |
| `/api/sharing/users/search` | GET | Search users by email/name |

## Common Patterns

### Request/Response Format
All endpoints use JSON for request and response bodies.

```typescript
// Request
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* payload */ })
});

// Response
const data = await response.json();
```

### Error Handling
Errors return appropriate HTTP status codes with JSON body:

```typescript
// Error response format
{
  "error": "Error message",
  "details": "Optional additional details"
}

// Common status codes
// 400 - Bad Request (missing/invalid parameters)
// 404 - Not Found (resource doesn't exist)
// 500 - Server Error (internal error)
```

### Connection Credentials (Dual Format)
Endpoints that connect to target databases accept two formats:

```typescript
// Auth mode: send only connection ID (credentials resolved server-side from app DB)
{ connectionId: "abc123", source: "server", type: "postgresql" }

// Default mode: send full connection details
{ connection: { host: "...", port: "...", database: "...", username: "...", password: "..." } }
```

The `validateConnection()` function in `lib/database/connection-validator.ts` handles both formats.

**Security Note:** In auth mode, credentials are never sent from the client. In default mode (localStorage), credentials are passed from the client.

## OpenAI API Integration

Endpoints using OpenAI require:
1. `OPENAI_API_KEY` environment variable
2. `OPENAI_MODEL` environment variable — behavior varies per endpoint:

| Endpoint | `OPENAI_MODEL` fallback | Notes |
|----------|-------------------------|-------|
| `/api/query/generate` | **none — required** | Honors `OPENAI_REASONING_EFFORT` (not consulted on eval-override requests, which take effort from the body only); accepts per-request `model`/`effort` overrides only when `EVAL_ALLOW_MODEL_OVERRIDE=true` — an invalid `model` then returns 400 |
| `/api/query/enhance` | **none — required** | |
| `/api/query/revise` | **none — required** | |
| `/api/query/followup` | `gpt-5.1` | |
| `/api/dashboard/suggestions` | `gpt-5` | |
| `/api/schema/generate-descriptions` | `gpt-5` | |
| `/api/chart/generate` | `gpt-5-mini` | |

3. `OPENAI_REASONING_EFFORT` (optional) — reasoning effort for `/api/query/generate`.
   Accepted values: `none | minimal | low | medium | high | xhigh | max`. Empty or invalid
   means the `reasoning` parameter is omitted entirely (provider default). The parameter
   applies to **gpt-5 / o-series models only**, and the OpenAI API — not the SDK —
   validates whether a given model supports a given value. No other route reads it.
4. `EVAL_ALLOW_MODEL_OVERRIDE` (optional, off by default) — when `true`, `/api/query/generate`
   honors optional `model` and `effort` fields in the request body. This exists for the
   [eval harness](../../evals/README.md), not for normal clients; when unset, both fields
   are ignored.

OpenAI endpoints use the **Responses API** (not Chat Completions):

```typescript
const response = await client.responses.create({
  model: process.env.OPENAI_MODEL,
  tools: [{ type: "file_search", vector_store_ids: [vectorStoreId] }],
  input: [
    { role: "system", content: "..." },
    { role: "user", content: "..." }
  ]
});
```

`/api/query/generate` additionally returns a `usage` block (token counts and the model
OpenAI actually served) when OpenAI reports it — see
[Query Endpoints](./query-endpoints.md#token-usage-usage). The other OpenAI routes discard usage.

## Rate Limiting

Server-side rate limiting is available for demo deployments:

- **Configuration**: Set `DEMO_RATE_LIMIT` environment variable to limit requests per IP per 24-hour window
- **Bypass**: Users can provide their own OpenAI API key via `x-user-openai-key` header to bypass limits
- **Response**: Rate-limited requests return HTTP 429 with rate limit info in headers
- **Implementation**: `utils/rate-limiter.ts` handles in-memory IP tracking

### User-Provided API Keys (BYOK)

All OpenAI endpoints accept a user-provided API key:

```typescript
const response = await fetch('/api/query/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-user-openai-key': 'sk-...'  // Optional: user's own key
  },
  body: JSON.stringify({ /* payload */ })
});
```

OpenAI rate limits (from OpenAI's API) are handled with exponential backoff in the `generate-descriptions` endpoint.

## Endpoint Categories

### Query Operations
Handle SQL generation and execution:
- [Query Endpoints](./query-endpoints.md)

### Schema Operations
Manage database schema:
- [Schema Endpoints](./schema-endpoints.md)

### Dashboard Operations
AI suggestions and analytics:
- [Dashboard Endpoints](./dashboard-endpoints.md)

### Data, Admin & Sharing (auth mode)
User CRUD, admin server connections, and sharing:
- [Data Endpoints](./data-endpoints.md)

## Related Documentation
- [Architecture Overview](../architecture/overview.md) - System design
- [Auth & Data Layer](../architecture/auth-and-data-layer.md) - Auth, repositories, encryption
- [OpenAI Integration](../guides/openai-integration.md) - AI details
- [Models Overview](../models/overview.md) - TypeScript interfaces
