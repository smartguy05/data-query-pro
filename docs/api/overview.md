# API Overview

DataQuery Pro uses Next.js API routes for server-side operations. All routes are in `app/api/`.

## Endpoint Summary

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
| `/api/schema/start-introspection` | WS | WebSocket for introspection | [Schema Endpoints](./schema-endpoints.md) |
| `/api/schema/status` | GET | Poll introspection status | [Schema Endpoints](./schema-endpoints.md) |
| `/api/dashboard/suggestions` | POST | Generate metric suggestions | [Dashboard Endpoints](./dashboard-endpoints.md) |
| `/api/chart/generate` | POST | Generate chart config | [Dashboard Endpoints](./dashboard-endpoints.md) |
| `/api/config/connections` | GET | Get server-configured connections | - |
| `/api/config/rate-limit-status` | GET | Check rate limit status | - |

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

**Security Note:** Credentials are passed from client-side localStorage. This is not secure for production.

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

## Related Documentation
- [Architecture Overview](../architecture/overview.md) - System design
- [OpenAI Integration](../guides/openai-integration.md) - AI details
- [Models Overview](../models/overview.md) - TypeScript interfaces
