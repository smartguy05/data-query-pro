# Architecture Overview

DataQuery Pro is a Next.js 15 application using the App Router pattern with React 19. It enables natural language querying of PostgreSQL, MySQL, SQL Server, and SQLite databases via OpenAI integration.

## System Architecture

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
    │ Database │    │ Database │         │ OpenAI   │
    │(Execute) │    │(Introspect)│       │   API    │
    └──────────┘    └──────────┘         └──────────┘
    PG/MySQL/       PG/MySQL/
    SQLServer/      SQLServer/
    SQLite          SQLite
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
├── landing/                 # Public landing page (/landing)
└── api/                     # API routes
    ├── query/               # Query generation/execution/enhance/revise/followup
    ├── schema/              # Schema introspection/descriptions/upload
    ├── connection/          # Connection testing
    ├── dashboard/           # Suggestions generation
    ├── chart/               # Chart configuration
    └── config/              # Server config and rate limit status

components/                   # React components
├── ui/                      # shadcn/ui (DO NOT modify)
├── charts/                  # Chart implementations (bar, line, pie, area, scatter)
├── navigation.tsx           # Top navigation
├── schema-explorer.tsx      # Schema browser
├── query-results-display.tsx # Results with charts
├── query-tab-content.tsx    # Query tab display
├── followup-dialog.tsx      # Follow-up question dialog
├── error-boundary.tsx       # Error boundary wrapper
└── [feature components]     # Reports, API key, theme, etc.

lib/                         # Core utilities
├── database-connection-options.tsx  # State context
├── database/                # Database adapter system (factory + 4 adapters)
├── openai/                  # OpenAI integration utilities
├── api/                     # API response helpers
├── csrf.ts                  # CSRF protection
├── constants.ts             # App constants
└── server-config.ts         # Server config reader

models/                      # TypeScript interfaces
├── database-connection.interface.ts
├── schema.interface.ts
├── database-table.interface.ts
├── column.interface.ts
├── saved-report.interface.ts
├── chart-config.interface.ts
├── query-tab.interface.ts
└── common-types.ts

utils/                       # Utility functions
├── generate-descriptions.ts # Fallback AI descriptions
├── compare-schemas.ts       # Schema diffing
├── rate-limiter.ts          # IP-based rate limiting
└── error-sanitizer.ts       # Error sanitization

hooks/                       # Custom React hooks
├── use-mobile.tsx           # Responsive detection
├── use-toast.ts             # Toast notifications
├── use-openai-key.tsx       # API key management
├── use-openai-fetch.tsx     # Fetch with auth/rate-limit
├── use-unsaved-changes.ts   # Unsaved changes tracking
└── use-schema-loading.ts    # Schema loading state
```

## Page Responsibilities

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Dashboard with setup progress, suggestions, reports |
| `/database` | `app/database/page.tsx` | CRUD for database connections |
| `/schema` | `app/schema/page.tsx` | Browse and edit schema metadata |
| `/query` | `app/query/page.tsx` | Natural language query interface |
| `/reports` | `app/reports/page.tsx` | Saved reports management |
| `/landing` | `app/landing/page.tsx` | Public landing page with features/screenshots |

## Core Patterns

### 1. Client-Side State
All state is managed client-side via React Context + localStorage. See [State Management](./state-management.md).

### 2. API Route Pattern
API routes follow RESTful conventions:
- `POST /api/query/generate` - Generate SQL from natural language
- `POST /api/query/execute` - Execute SQL queries
- `POST /api/query/enhance` - Enhance vague queries with AI
- `POST /api/query/revise` - Revise failed queries
- `POST /api/query/followup` - Follow-up questions on results
- `POST /api/schema/introspect` - Get database schema
- `POST /api/schema/upload-schema` - Upload to OpenAI
- `POST /api/connection/test` - Test database connectivity

### 3. OpenAI Integration Pattern
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
│   └── OpenAIApiProvider (API key context)
│       └── DatabaseConnectionOptions (state context)
│           ├── Navigation
│           │   └── ApiKeyIndicator
│           ├── ErrorBoundary
│           │   └── [Page Component]
│           │       └── [Page Content]
│           └── Toaster (notifications)
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
3. Connect to database via adapter
4. Execute query
5. Format results → { columns, rows, rowCount, executionTime }
6. Display in QueryResultsDisplay component
```

## Related Documentation
- [State Management](./state-management.md) - Detailed context documentation
- [API Overview](../api/overview.md) - All API endpoints
- [Getting Started](../guides/getting-started.md) - Setup guide
