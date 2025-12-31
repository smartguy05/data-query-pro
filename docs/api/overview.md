# API Overview

DataQuery Pro uses Next.js API routes for server-side operations. All routes are in `app/api/`.

## Endpoint Summary

### Query & Schema
| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/query/generate` | POST | Convert natural language to SQL | User |
| `/api/query/execute` | POST | Execute SQL on database | User + Connection Access |
| `/api/schema/introspect` | GET/POST | Database schema introspection | Admin |
| `/api/schema/upload-schema` | POST | Upload schema to OpenAI | Admin |
| `/api/schema/generate-descriptions` | POST | Generate AI descriptions | Admin |
| `/api/schema/update-description` | POST | Update single description | Admin |
| `/api/schema/start-introspection` | WS | WebSocket for introspection | Admin |
| `/api/schema/status` | GET | Poll introspection status | User |

### Dashboard & Reports
| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/dashboard/suggestions` | POST | Generate metric suggestions | User + Connection Access |
| `/api/chart/generate` | POST | Generate chart config | User |
| `/api/reports/[id]/share` | PATCH | Toggle report sharing | User (owner) |

### Admin (Multi-User Mode Only)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/stats` | GET | Dashboard statistics |
| `/api/admin/users` | GET | List all users |
| `/api/admin/users/[id]` | PATCH, DELETE | Update/delete user |
| `/api/admin/connections` | GET, POST | List/create connections |
| `/api/admin/connections/[id]` | PATCH, DELETE | Update/delete connection |
| `/api/admin/permissions` | GET, POST, DELETE | Manage user-connection access |

### Authentication (Multi-User Mode Only)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/[...nextauth]` | * | NextAuth.js handler |

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

### Connection Credentials
Several endpoints require database connection credentials:

```typescript
interface ConnectionPayload {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}
```

**Security Note:** In single-user mode, credentials are passed from client-side localStorage. In multi-user mode, credentials are stored encrypted in PostgreSQL.

## Authentication (Multi-User Mode)

When `MULTI_USER_ENABLED=true`, all API routes are protected by middleware and the `withAuth` wrapper.

### Route Protection Levels

| Level | Description | Example Routes |
|-------|-------------|----------------|
| **None** | Public routes, no auth required | `/api/auth/*`, `/login` |
| **User** | Any authenticated user | `/api/query/generate`, `/api/chart/generate` |
| **User + Connection Access** | User with explicit connection permission | `/api/query/execute`, `/api/dashboard/suggestions` |
| **Admin** | Users with `role: "admin"` only | `/api/admin/*`, `/api/schema/introspect` |

### The `withAuth` Wrapper

API routes use the `withAuth` higher-order function:

```typescript
import { withAuth } from "@/lib/auth/api-auth";

export const POST = withAuth(
  async (request, { user, params }) => {
    // user.id, user.email, user.role are available
    // Handle request...
  },
  { requireAdmin: true }  // Optional: require admin role
);
```

### Middleware Headers

In multi-user mode, middleware adds user info to request headers:

```typescript
// Available in API routes via request.headers
request.headers.get("x-user-id")     // User's ID
request.headers.get("x-user-role")   // "admin" or "user"
request.headers.get("x-user-email")  // User's email
```

### Error Responses

| Status | When |
|--------|------|
| 401 Unauthorized | No valid session |
| 403 Forbidden | User lacks required role or connection access |

## OpenAI API Integration

Endpoints using OpenAI require:
1. `OPENAI_API_KEY` environment variable
2. `OPENAI_MODEL` environment variable (defaults to model specified)

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

## Rate Limiting

No server-side rate limiting is implemented. OpenAI rate limits are handled with exponential backoff in the `generate-descriptions` endpoint.

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

## Related Documentation
- [Architecture Overview](../architecture/overview.md) - System design
- [OpenAI Integration](../guides/openai-integration.md) - AI details
- [Models Overview](../models/overview.md) - TypeScript interfaces
