# Architecture Overview

DataQuery Pro is a Next.js 15 application using the App Router pattern with React 19. It enables natural language querying of PostgreSQL, MySQL, SQL Server, and SQLite databases via OpenAI integration.

## System Architecture

The application supports two modes: **default** (localStorage) and **auth** (PostgreSQL + OIDC).

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
│                  ┌────────┴────────┐                            │
│                  │ StorageProvider  │                            │
│                  │ (localStorage   │                            │
│                  │  or API-backed) │                            │
│                  └─────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                            │ HTTP
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API Routes                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │   Query    │  │   Schema     │  │  Auth / Data / Admin│    │
│  │  Endpoints │  │  Endpoints   │  │  Endpoints          │    │
│  └──────┬─────┘  └──────┬───────┘  └──────────┬──────────┘    │
└─────────┼───────────────┼─────────────────────┼───────────────┘
          │               │                     │
          ▼               ▼                     ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐  ┌──────────┐
    │ Target   │    │ Target   │    │ OpenAI   │  │ App DB   │
    │ Database │    │ Database │    │   API    │  │(Postgres)│
    │(Execute) │    │(Introspect)│  └──────────┘  └──────────┘
    └──────────┘    └──────────┘
    PG/MySQL/       PG/MySQL/
    SQLServer/      SQLServer/
    SQLite          SQLite
```

## Directory Structure

```
app/                          # Next.js App Router
├── page.tsx                 # Dashboard (/)
├── layout.tsx               # Root layout with providers + ContentLoadingGate
├── database/page.tsx        # Connection management (/database)
├── query/page.tsx           # Query interface (/query)
├── schema/page.tsx          # Schema explorer (/schema)
├── reports/page.tsx         # Saved reports (/reports)
├── learning/page.tsx        # Query corrections curation (/learning)
├── profile/page.tsx         # Account overview & usage stats (/profile)
├── admin/page.tsx           # Admin panel (/admin) — server connections & assignments
├── landing/                 # Public landing page (/landing)
└── api/                     # API routes
    ├── query/               # Query generation/execution/enhance/revise/followup
    ├── schema/              # Schema introspection/descriptions/upload/sample-data
    ├── connection/          # Connection testing
    ├── dashboard/           # Suggestions generation
    ├── chart/               # Chart configuration
    ├── config/              # Server config, rate limit, auth status
    ├── auth/                # Auth.js OIDC handler
    ├── data/                # Authenticated CRUD (connections, schemas, reports,
    │                        #   query-accuracy, corrections, etc.)
    └── admin/               # Admin endpoints (server connections, assignments)

components/                   # React components
├── ui/                      # shadcn/ui (DO NOT modify)
├── charts/                  # Chart implementations (bar, line, pie, area, scatter)
├── content-loading-gate.tsx # Loading gate until context is initialized
├── navigation.tsx           # Top navigation (with user menu when auth enabled)
├── auth-provider.tsx        # SessionProvider wrapper (conditional)
├── schema-explorer.tsx      # Schema browser
├── query-results-display.tsx # Results with charts
├── query-tab-content.tsx    # Query tab display
├── followup-dialog.tsx      # Follow-up question dialog
├── saved-reports.tsx        # Report list with clone/copy-to-connection
├── share-dialog.tsx         # Share connections/reports with users
├── data-migration-dialog.tsx # Import localStorage data on first login
├── error-boundary.tsx       # Error boundary wrapper
└── [feature components]     # Reports, API key, theme, etc.

lib/                         # Core utilities
├── database-connection-options.tsx  # State context (uses StorageProvider)
├── storage/                 # Storage abstraction
│   ├── storage-provider.ts  # Interface
│   ├── local-storage-provider.ts  # localStorage impl (default)
│   └── api-storage-provider.ts    # API-backed impl (auth mode)
├── auth/                    # Authentication
│   ├── config.ts            # isAuthEnabled() check
│   ├── auth-options.ts      # NextAuth OIDC config
│   └── require-auth.ts      # getAuthContext() + requireAdmin()
├── db/                      # App database (PostgreSQL)
│   ├── pool.ts              # Connection pool
│   ├── encryption.ts        # AES-256-GCM password encryption
│   ├── migrate.ts           # SQL migration runner
│   ├── migrations/          # SQL migration files (001-006)
│   └── repositories/        # Data access layer (11 repositories)
├── database/                # Database adapter system (factory + 4 adapters)
│   └── sql-validator.ts     # AST read-only SQL validation (validateReadOnlySql)
├── openai/                  # OpenAI integration utilities
├── api/                     # API response helpers
├── query-log.ts            # Query audit log entry point (logQuery)
├── query-log-file.ts       # JSONL fallback when app DB disabled
├── csrf.ts                  # CSRF protection
├── constants.ts             # App constants
└── server-config.ts         # Server config reader

models/                      # TypeScript interfaces
├── database-connection.interface.ts
├── database-context-type.interface.ts
├── schema.interface.ts
├── database-table.interface.ts
├── column.interface.ts
├── saved-report.interface.ts
├── chart-config.interface.ts
├── query-tab.interface.ts
├── query-accuracy.interface.ts
├── query-correction.interface.ts
└── common-types.ts

utils/                       # Utility functions
├── generate-descriptions.ts # Fallback AI descriptions
├── compare-schemas.ts       # Schema diffing
├── rate-limiter.ts          # IP-based rate limiting
├── schema-fingerprint.ts    # Stable fingerprint of a schema for learning
├── example-relevance.ts     # Ranks few-shot examples by relevance
├── query-corrections.ts     # Device-local captured query corrections
└── error-sanitizer.ts       # Error sanitization

hooks/                       # Custom React hooks
├── use-mobile.tsx           # Responsive detection
├── use-toast.ts             # Toast notifications
├── use-openai-key.tsx       # API key management
├── use-openai-fetch.tsx     # Fetch with auth/rate-limit
├── use-unsaved-changes.ts   # Unsaved changes tracking
├── use-schema-loading.ts    # Schema loading state
└── use-auth.ts              # Authentication state (user, isAdmin, signIn/signOut)
```

## Page Responsibilities

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Dashboard with setup progress, suggestions, reports |
| `/database` | `app/database/page.tsx` | CRUD for database connections |
| `/schema` | `app/schema/page.tsx` | Browse and edit schema metadata |
| `/query` | `app/query/page.tsx` | Natural language query interface |
| `/reports` | `app/reports/page.tsx` | Saved reports management (with connection selector) |
| `/learning` | `app/learning/page.tsx` | Curate captured query corrections for the current schema |
| `/profile` | `app/profile/page.tsx` | Account overview, usage stats, admin/sign-out actions |
| `/admin` | `app/admin/page.tsx` | Admin panel: server connections & assignments (auth only) |
| `/landing` | `app/landing/page.tsx` | Public landing page with features/screenshots |

## Core Patterns

### 1. Dual-Mode State
State is managed via React Context backed by a `StorageProvider`:
- **Default mode**: `LocalStorageProvider` reads/writes to browser localStorage
- **Auth mode**: `ApiStorageProvider` calls `/api/data/*` routes backed by PostgreSQL

See [State Management](./state-management.md).

### 2. API Route Pattern
API routes follow RESTful conventions:
- `POST /api/query/generate` - Generate SQL from natural language
- `POST /api/query/execute` - Execute SQL queries
- `POST /api/query/enhance` - Enhance vague queries with AI
- `POST /api/query/revise` - Revise failed queries
- `POST /api/query/followup` - Follow-up questions on results
- `POST /api/schema/introspect` - Get database schema
- `POST /api/schema/upload-schema` - Upload to OpenAI
- `POST /api/schema/sample-data` - Read-only sample rows for a table
- `POST /api/connection/test` - Test database connectivity
- `GET/PUT /api/data/query-accuracy` - Per-user query accuracy counters (auth mode)
- `GET/POST /api/data/corrections`, `PUT/DELETE /api/data/corrections/[id]` -
  Team-wide query corrections, pooled by schema fingerprint (auth mode)

### 3. OpenAI Integration Pattern
Uses OpenAI Responses API (not Chat Completions):
1. Schema uploaded as file to OpenAI
2. File added to vector store
3. `file_search` tool provides schema context
4. Natural language converted to SQL

See [OpenAI Integration Guide](../guides/openai-integration.md).

### 4. Learn-From-Previous-Queries Pattern
Query generation is improved by learning from prior queries, keyed by a stable
**schema fingerprint** (`utils/schema-fingerprint.ts`):
- **Phase 1 (device-local)**: captured corrections (`utils/query-corrections.ts`)
  and relevance-ranked few-shot examples (`utils/example-relevance.ts`) are built
  client-side and sent to `/api/query/generate`. The server's
  `buildLearningSections()` injects guarded few-shot and avoid-these-mistakes prompt
  sections (`AI.MAX_FEW_SHOT`, `AI.MAX_CORRECTIONS`, `CORRECTIONS.MAX_ENTRIES`).
- **Phase 2 (team-wide, auth mode only)**: failed→revised corrections are pooled
  across a team purely by `schema_fingerprint` (migration `006_query_corrections.sql`,
  `query-correction-repository.ts`, `/api/data/corrections`). The `/learning` page
  curates them; updates/deletes are gated by owner-or-admin on the server.

### 5. Read-Only Execution & Audit Log
- Query execution and table sampling set `AdapterConnectionConfig.readOnly`, enforced
  per dialect (PostgreSQL/MySQL read-only transactions, SQL Server wrap+ROLLBACK,
  SQLite connect-time readonly). Introspection stays writable.
- SQL is validated by `validateReadOnlySql()` (`lib/database/sql-validator.ts`), an
  AST-based check (node-sql-parser) that allows a single SELECT only, replacing the
  former regex keyword blocklist.
- `logQuery()` (`lib/query-log.ts`) writes a credential-free audit entry to the
  `query_log` table when the app DB is enabled, otherwise to `logs/query-log.jsonl`.

## Component Hierarchy

```
layout.tsx
├── ThemeProvider (next-themes)
│   └── AuthProvider (SessionProvider, conditional)
│       └── OpenAIApiProvider (API key context)
│           └── DatabaseConnectionOptions (state context)
│               ├── Navigation (Dashboard + Data/Query dropdowns; profile menu)
│               │   └── ApiKeyIndicator
│               ├── ErrorBoundary
│               │   └── ContentLoadingGate (shows spinner until initialized)
│               │       └── [Page Component]
│               │           └── [Page Content]
│               ├── DataMigrationDialog (first-login import)
│               └── Toaster (notifications)
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
   - learning context (few-shot examples + past corrections, built client-side
     per schema fingerprint)
3. OpenAI Responses API with file_search; server buildLearningSections() injects
   guarded few-shot and avoid-these-mistakes prompt sections
4. Parse JSON response → { sql, explanation, confidence }
5. Display SQL and option to execute
```

### Executing a Query
```
1. POST /api/query/execute with:
   - Auth mode:    { sql, connectionId, source, type }
   - Default mode: { sql, connection: { host, port, ... } }
2. Validate query via validateReadOnlySql() — AST parse (node-sql-parser),
   allows a single SELECT only, with heuristicReadOnly() fallback if the parser throws
3. Resolve credentials (from DB or client payload via validateConnection)
4. Connect to database via adapter with readOnly=true (per-dialect read-only
   transaction / ROLLBACK / connect-time readonly)
5. Execute query
6. logQuery() records a credential-free audit entry (fire-and-forget)
7. Format results → { columns, rows, rowCount, executionTime }
8. Display in QueryResultsDisplay component
```

### Authentication Flow (when enabled)
```
1. User visits app → redirected to Authentik login
2. OIDC callback → Auth.js creates JWT with userId, groups, isAdmin
3. API routes call getAuthContext(request):
   - Auth disabled: returns null (pass-through)
   - Auth enabled: returns { userId, groups, isAdmin }
4. Credentials resolved server-side from app DB (never trusted from client)
5. Admin features: server connection CRUD, user/group assignments
```
See [Auth & Data Layer](./auth-and-data-layer.md) for the full picture (repositories,
encryption, migrations, credential resolution).

### Server Connection Lifecycle
```
1. Admin creates server connection → stored in app DB (source='server', owner_id=null)
2. Admin navigates to schema page → auto-introspects schema
3. Schema saved → connection becomes visible to assigned non-admin users
4. Users can query the connection using admin-uploaded schema
5. Deleting connection cascades to schemas, reports, suggestions, assignments
```

## Related Documentation
- [State Management](./state-management.md) - Detailed context documentation
- [Auth & Data Layer](./auth-and-data-layer.md) - Auth, repositories, encryption, migrations
- [API Overview](../api/overview.md) - All API endpoints
- [Getting Started](../guides/getting-started.md) - Setup guide
