# DataQuery Pro Documentation

This documentation provides comprehensive developer guidance for the DataQuery Pro codebase.

## Quick Navigation

### Architecture
- [Architecture Overview](./architecture/overview.md) - System design and component relationships
- [State Management](./architecture/state-management.md) - React Context, localStorage, and data flow

### API Reference
- [API Overview](./api/overview.md) - All endpoints and patterns
- [Query Endpoints](./api/query-endpoints.md) - SQL generation and execution
- [Schema Endpoints](./api/schema-endpoints.md) - Database introspection and management
- [Dashboard Endpoints](./api/dashboard-endpoints.md) - Suggestions and metrics

### Components
- [Components Overview](./components/overview.md) - Component hierarchy and responsibilities
- [Page Components](./components/pages.md) - App router pages
- [Feature Components](./components/features.md) - Reusable feature components

### Data Models
- [Models Overview](./models/overview.md) - All TypeScript interfaces

### Developer Guides
- [Getting Started](./guides/getting-started.md) - Setup and configuration
- [Adding Database Support](./guides/adding-database-support.md) - Extending for new databases
- [OpenAI Integration](./guides/openai-integration.md) - AI features and vector stores
- [Common Tasks](./guides/common-tasks.md) - Frequent development workflows

## Key Concepts

### Data Flow Summary
```
User creates connection → localStorage → Context
Schema introspection → PostgreSQL query → Context cache
Schema upload → OpenAI file + vector store → Connection metadata
Natural language → OpenAI API → SQL → PostgreSQL → Results
```

### Technology Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, shadcn/ui, Tailwind CSS |
| State | React Context + localStorage |
| Database | PostgreSQL (postgres library) |
| AI | OpenAI API (Responses API) |
| Charts | Recharts |

### Important Files
| File | Purpose |
|------|---------|
| `lib/database-connection-options.tsx` | Central state management |
| `app/api/query/generate/route.ts` | Natural language to SQL |
| `app/api/query/execute/route.ts` | SQL execution |
| `app/api/schema/introspect/route.ts` | Database introspection |
| `models/*.interface.ts` | TypeScript interfaces |

## Known Limitations

1. **PostgreSQL Only** - Despite UI options, only PostgreSQL is implemented
2. **localStorage Storage** - All data stored client-side (not production-ready)
3. **No Authentication** - No user auth or row-level security
4. **Plain Text Passwords** - Credentials stored unencrypted
5. **Schema Upload Required** - Must upload schema to OpenAI before queries work

## Environment Variables

```bash
OPENAI_API_KEY=sk-...    # Required for AI features
OPENAI_MODEL=gpt-5      # Model for query generation
```
