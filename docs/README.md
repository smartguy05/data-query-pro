# DataQuery Pro Documentation

This documentation provides comprehensive developer guidance for the DataQuery Pro codebase.

## Quick Navigation

### Architecture
- [Architecture Overview](./architecture/overview.md) - System design and component relationships
- [State Management](./architecture/state-management.md) - React Context, StorageProvider, and data flow

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
- [Authentication Testing](./guides/authentication-testing.md) - Local Authentik setup for OIDC testing
- [Adding Database Support](./guides/adding-database-support.md) - Extending for new databases
- [OpenAI Integration](./guides/openai-integration.md) - AI features and vector stores
- [Common Tasks](./guides/common-tasks.md) - Frequent development workflows

## Key Concepts

### Dual-Mode Architecture
DataQuery Pro operates in two modes:

| Mode | Storage | Auth | Use Case |
|------|---------|------|----------|
| **Default** | localStorage | None | Single-user / development |
| **Auth Enabled** | PostgreSQL | Authentik OIDC | Multi-user / production |

Auth mode is enabled by setting `AUTH_OIDC_ISSUER`, `AUTH_OIDC_CLIENT_ID`, and `AUTH_OIDC_CLIENT_SECRET`.

### Data Flow Summary
```
Default mode:   User → localStorage → Context → UI
Auth mode:      User → /api/data/* → PostgreSQL → Context → UI

Schema:         Connection → Database adapter introspect → Context → OpenAI upload
Queries:        Natural language → OpenAI API → SQL → Database adapter → Results
```

### Technology Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, shadcn/ui, Tailwind CSS |
| State | React Context + StorageProvider (localStorage or API) |
| Auth | Auth.js v5 (next-auth) with OIDC |
| App Database | PostgreSQL via `postgres` npm package |
| Target Databases | PostgreSQL, MySQL, SQL Server, SQLite |
| AI | OpenAI API (Responses API) |
| Charts | Recharts |

### Important Files
| File | Purpose |
|------|---------|
| `lib/database-connection-options.tsx` | Central state management (uses StorageProvider) |
| `lib/storage/storage-provider.ts` | Storage abstraction interface |
| `lib/auth/auth-options.ts` | Auth.js OIDC configuration |
| `lib/auth/require-auth.ts` | `getAuthContext()` for API routes |
| `lib/database/connection-validator.ts` | Credential resolution (DB or client) |
| `lib/db/repositories/` | Data access layer (8 repositories) |
| `app/api/query/generate/route.ts` | Natural language to SQL |
| `app/api/query/execute/route.ts` | SQL execution |
| `app/api/schema/introspect/route.ts` | Database introspection |

## Known Limitations

1. **localStorage Storage** - Default mode stores all data client-side (enable auth for server-side storage)
2. **Schema Upload Required** - Must upload schema to OpenAI before queries work
3. **Server Connections** - Non-admin users cannot see server connections until admin uploads a schema

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...        # Required for AI features
OPENAI_MODEL=gpt-5           # Model for query generation

# Optional
DEMO_RATE_LIMIT=             # API requests per IP per 24h (empty = unlimited)
TRUSTED_PROXIES=             # Comma-separated trusted proxy IPs

# Authentication (all 3 required to enable auth mode)
AUTH_OIDC_ISSUER=            # e.g. https://auth.example.com/application/o/app/
AUTH_OIDC_CLIENT_ID=
AUTH_OIDC_CLIENT_SECRET=
AUTH_SECRET=                 # JWT signing key (openssl rand -hex 32)
AUTH_URL=                    # e.g. http://localhost:3000
AUTH_ADMIN_GROUP=            # Authentik group name for admin access

# App Database (required when auth enabled)
APP_DATABASE_URL=            # e.g. postgres://user:pass@localhost:5432/app_db

# Encryption (required when auth enabled)
APP_ENCRYPTION_KEY=          # 64-char hex (openssl rand -hex 32)
```

## Additional Features

- **Authentication** - Optional OIDC authentication via Authentik with admin/user roles
- **Admin Panel** - Manage server connections, assign to users/groups
- **Connection Sharing** - Share connections and reports with other users (view/edit/admin)
- **Data Migration** - Auto-import localStorage data on first authenticated login
- **Server Connections** - Admin-managed connections stored in DB, visible to assigned users after schema upload
- **Copy Reports** - Copy reports across connections (dev/staging/prod workflows)
- **Landing Page** - Product showcase at `/landing` route
- **Rate Limiting** - Optional IP-based rate limiting for demo deployments
- **BYOK** - Users can provide their own OpenAI API key to bypass rate limits
- **Server Config** - Pre-configured connections via `config/databases.json` (file-based, read-only)
