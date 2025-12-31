# Architecture Overview

DataQuery Pro is a Next.js 15 application using the App Router pattern with React 19. It enables natural language querying of PostgreSQL databases via OpenAI integration.

## Deployment Modes

DataQuery Pro supports two deployment modes:

| Mode | Storage | Auth | Use Case |
|------|---------|------|----------|
| **Single-User** | localStorage | None | Personal use, development |
| **Multi-User** | PostgreSQL | Azure AD SSO | Team deployment |

Set `MULTI_USER_ENABLED=true` to enable multi-user mode.

## System Architecture

### Single-User Mode
```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Pages      │  │  Components  │  │  Context Provider    │  │
│  │  (App Router)│  │  (shadcn/ui) │  │  (DatabaseOptions)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┴──────────────────────┘              │
│                           │                                     │
│                    ┌──────┴──────┐                             │
│                    │ localStorage │                             │
│                    └─────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
                            │ HTTP
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API Routes                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │   Query    │  │   Schema     │  │    Dashboard        │    │
│  │  Endpoints │  │  Endpoints   │  │    Endpoints        │    │
│  └──────┬─────┘  └──────┬───────┘  └──────────┬──────────┘    │
└─────────┼───────────────┼─────────────────────┼───────────────┘
          │               │                     │
          ▼               ▼                     ▼
    ┌──────────┐    ┌──────────┐         ┌──────────┐
    │PostgreSQL│    │PostgreSQL│         │ OpenAI   │
    │(Execute) │    │(Introspect)│        │   API    │
    └──────────┘    └──────────┘         └──────────┘
```

### Multi-User Mode
```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Pages      │  │  Components  │  │  SessionProvider     │  │
│  │  (App Router)│  │  (shadcn/ui) │  │  (NextAuth.js)       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┴──────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                            │ HTTP
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js Middleware                         │
│                   (Route Protection + Auth)                      │
└─────────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API Routes                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐    │
│  │  Query   │ │  Schema  │ │ Dashboard│ │  Admin Routes  │    │
│  │ Endpoints│ │ Endpoints│ │ Endpoints│ │(Users/Perms)   │    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬────────┘    │
│       │            │            │               │              │
│       └────────────┴────────────┴───────────────┘              │
│                           │                                     │
│                    ┌──────┴──────┐                             │
│                    │Storage Layer│ (PostgreSQL adapter)        │
│                    └─────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
          │               │                     │
          ▼               ▼                     ▼
    ┌──────────┐    ┌──────────┐         ┌──────────┐
    │PostgreSQL│    │PostgreSQL│         │ Azure AD │
    │(App Data)│    │(User DBs)│         │   SSO    │
    └──────────┘    └──────────┘         └──────────┘
```

## Directory Structure

```
app/                          # Next.js App Router
├── page.tsx                 # Dashboard (/)
├── layout.tsx               # Root layout with providers
├── database/page.tsx        # Connection management (/database)
├── query/page.tsx           # Query interface (/query)
├── schema/page.tsx          # Schema explorer (/schema)
├── reports/page.tsx         # Saved reports (/reports)
├── login/                   # Login page (multi-user)
├── admin/                   # Admin pages (multi-user)
│   ├── layout.tsx          # Admin layout with sidebar
│   ├── page.tsx            # Admin dashboard
│   ├── users/page.tsx      # User management
│   ├── connections/page.tsx # Connection management
│   └── permissions/page.tsx # Permissions matrix
└── api/                     # API routes
    ├── auth/[...nextauth]/ # NextAuth.js handler
    ├── query/               # Query generation/execution
    ├── schema/              # Schema introspection
    ├── dashboard/           # Suggestions generation
    ├── reports/             # Report sharing
    └── admin/               # Admin endpoints (multi-user)

components/                   # React components
├── ui/                      # shadcn/ui (DO NOT modify)
├── auth/                    # Auth components (multi-user)
├── navigation.tsx           # Top navigation
├── schema-explorer.tsx      # Schema browser
├── query-results-display.tsx# Results with charts
└── [feature components]     # Reports, charts, etc.

lib/                         # Core utilities
├── database-connection-options.tsx  # State context
├── auth/                    # Auth helpers (multi-user)
│   ├── auth.config.ts      # NextAuth configuration
│   └── api-auth.ts         # withAuth API wrapper
├── db/                      # Database utilities (multi-user)
│   ├── connection.ts       # PostgreSQL connection pool
│   └── encryption.ts       # Password encryption
└── services/storage/        # Storage abstraction
    ├── storage.interface.ts # Storage interfaces
    ├── local-storage.adapter.ts # localStorage implementation
    ├── postgres.adapter.ts  # PostgreSQL implementation
    └── index.ts             # Storage factory

models/                      # TypeScript interfaces
├── database-connection.interface.ts
├── schema.interface.ts
├── database-table.interface.ts
├── column.interface.ts
└── saved-report.interface.ts

utils/                       # Utility functions
├── generate-descriptions.ts # Fallback AI descriptions
└── compare-schemas.ts       # Schema diffing

hooks/                       # Custom React hooks
├── use-mobile.tsx          # Responsive detection
└── use-toast.ts            # Toast notifications

middleware.ts                # Route protection (multi-user)

types/                       # TypeScript declarations
└── next-auth.d.ts          # NextAuth type extensions
```

## Page Responsibilities

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Dashboard with setup progress, suggestions, reports |
| `/database` | `app/database/page.tsx` | CRUD for database connections |
| `/schema` | `app/schema/page.tsx` | Browse and edit schema metadata |
| `/query` | `app/query/page.tsx` | Natural language query interface |
| `/reports` | `app/reports/page.tsx` | Saved reports management |
| `/login` | `app/login/page.tsx` | Azure SSO login (multi-user) |
| `/admin` | `app/admin/page.tsx` | Admin dashboard (multi-user) |
| `/admin/users` | `app/admin/users/page.tsx` | User management (multi-user) |
| `/admin/connections` | `app/admin/connections/page.tsx` | Connection management (multi-user) |
| `/admin/permissions` | `app/admin/permissions/page.tsx` | Permission matrix (multi-user) |

## Core Patterns

### 1. Storage Abstraction
Data persistence uses the Storage Service pattern with pluggable adapters:

```typescript
interface IStorageService {
  connections: IConnectionStorageService;
  schemas: ISchemaStorageService;
  reports: IReportStorageService;
  suggestions: ISuggestionStorageService;
  users: IUserStorageService;
  permissions: IPermissionStorageService;
  notifications: INotificationStorageService;
  isMultiUserEnabled(): boolean;
}
```

| Adapter | Storage | When Used |
|---------|---------|-----------|
| `LocalStorageAdapter` | Browser localStorage | `MULTI_USER_ENABLED=false` |
| `PostgresAdapter` | PostgreSQL database | `MULTI_USER_ENABLED=true` |

### 2. Client-Side State
All state is managed client-side via React Context. In single-user mode, data is persisted to localStorage. In multi-user mode, data is fetched from PostgreSQL. See [State Management](./state-management.md).

### 3. API Route Pattern
API routes follow RESTful conventions:
- `POST /api/query/generate` - Generate SQL from natural language
- `POST /api/query/execute` - Execute SQL queries
- `POST /api/schema/introspect` - Get database schema
- `POST /api/schema/upload-schema` - Upload to OpenAI

### 4. OpenAI Integration Pattern
Uses OpenAI Responses API (not Chat Completions):
1. Schema uploaded as file to OpenAI
2. File added to vector store
3. `file_search` tool provides schema context
4. Natural language converted to SQL

See [OpenAI Integration Guide](../guides/openai-integration.md).

## Component Hierarchy

```
layout.tsx
├── ThemeProvider (next-themes)
├── DatabaseConnectionOptions (context)
│   └── [Page Component]
│       ├── Navigation
│       └── [Page Content]
└── Toaster (notifications)
```

## Data Flow Examples

### Creating a Connection
```
1. User fills form → onSubmit handler
2. Create DatabaseConnection object with UUID
3. Call context.addConnection()
4. Context updates state + localStorage
5. UI re-renders with new connection
```

### Generating a Query
```
1. User enters natural language query
2. POST /api/query/generate with:
   - query text
   - vectorStoreId (from connection)
   - databaseType
3. OpenAI Responses API with file_search
4. Parse JSON response → { sql, explanation, confidence }
5. Display SQL and option to execute
```

### Executing a Query
```
1. POST /api/query/execute with:
   - sql (generated or manual)
   - connection credentials
2. Validate query (no DROP/DELETE/etc)
3. Connect to PostgreSQL
4. Execute query
5. Format results → { columns, rows, rowCount, executionTime }
6. Display in QueryResultsDisplay component
```

## Related Documentation
- [State Management](./state-management.md) - Detailed context documentation
- [API Overview](../api/overview.md) - All API endpoints
- [Getting Started](../guides/getting-started.md) - Setup guide
