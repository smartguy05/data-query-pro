# API Overview

DataQuery Pro uses Next.js API routes for server-side operations. All routes are in `app/api/`.

## Endpoint Summary

| Endpoint | Method | Purpose | Documentation |
|----------|--------|---------|---------------|
| `/api/query/generate` | POST | Convert natural language to SQL | [Query Endpoints](./query-endpoints.md) |
| `/api/query/execute` | POST | Execute SQL on database | [Query Endpoints](./query-endpoints.md) |
| `/api/schema/introspect` | GET/POST | Database schema introspection | [Schema Endpoints](./schema-endpoints.md) |
| `/api/schema/upload-schema` | POST | Upload schema to OpenAI | [Schema Endpoints](./schema-endpoints.md) |
| `/api/schema/generate-descriptions` | POST | Generate AI descriptions | [Schema Endpoints](./schema-endpoints.md) |
| `/api/schema/update-description` | POST | Update single description | [Schema Endpoints](./schema-endpoints.md) |
| `/api/schema/start-introspection` | WS | WebSocket for introspection | [Schema Endpoints](./schema-endpoints.md) |
| `/api/schema/status` | GET | Poll introspection status | [Schema Endpoints](./schema-endpoints.md) |
| `/api/dashboard/suggestions` | POST | Generate metric suggestions | [Dashboard Endpoints](./dashboard-endpoints.md) |
| `/api/chart/generate` | POST | Generate chart config | [Dashboard Endpoints](./dashboard-endpoints.md) |

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
