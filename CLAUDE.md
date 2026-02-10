# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: Memory Files

**ALWAYS update the `.memories/` directory files when relevant.** These files track project state across sessions:

| File | Purpose | When to Update |
|------|---------|----------------|
| `.memories/completed.md` | Completed tasks by phase | When finishing ANY task, feature, or fix |
| `.memories/todos.md` | Remaining tasks and tech debt | When adding, completing, or deprioritizing tasks |
| `.memories/notes.md` | Issues, gotchas, lessons learned | When encountering bugs, workarounds, or patterns |

**Rules:**
1. Update these files **AT ALL TIMES** - they are the project's memory
2. Update `completed.md` immediately after finishing a task (not at end of session)
3. Update `todos.md` to check off completed items and add new discovered tasks
4. Update `notes.md` with any issue you debug/solve that others might hit
5. Keep entries concise but descriptive - future you needs to understand
6. Periodically prune the todos file to remove old completed items
7. Periodically summarize and prune completed.td to keep the file size small

> **Detailed Documentation**: See the [docs/](./docs/) folder for comprehensive developer documentation including architecture details, API references, and guides.

## Project Overview

DataQuery Pro is an AI-powered database visualization and query tool built with Next.js 15, React 19, and TypeScript. The application allows users to connect to PostgreSQL, MySQL, SQL Server, or SQLite databases, generate AI-powered schema descriptions, and query data using natural language that gets converted to SQL via OpenAI's API.

## Development Commands

```bash
# Development
npm run dev          # Start development server on localhost:3000

# Build and Production
npm run build        # Build for production
npm start            # Start production server

# Code Quality
npm run lint         # Run Next.js linter
```

## Architecture Overview

### State Management
The application uses a centralized **React Context** pattern for database connection state:

- **Provider**: `DatabaseConnectionOptions` component in `lib/database-connection-options.tsx`
- **Hook**: `useDatabaseOptions()` - use this hook in any component that needs database connection state
- **Storage**: Pluggable via `StorageProvider` — localStorage (default) or API-backed PostgreSQL (when auth enabled)
- **Important**: The context manages multiple database connections, current active connection, schema data, reports, and their synchronization with the storage layer

### Key Data Flow
1. User creates database connection → stored via StorageProvider → added to context
2. Schema introspection → uploaded as file to OpenAI → file ID and vector store ID saved to connection
3. AI descriptions generated → schema with descriptions stored via StorageProvider
4. Natural language query → sent to OpenAI with vector store context → generates SQL
5. SQL execution → database adapter connects and executes → results returned

### Credential Resolution (Auth Mode)
- Client sends only `{ connectionId, source, type }` — never credentials
- Server resolves credentials from app DB via `validateConnection()` in `connection-validator.ts`
- Default mode (no auth): client sends full `{ connection: { host, port, ... } }` as before

### Project Structure

```
app/                          # Next.js 15 App Router
├── page.tsx                 # Dashboard with AI suggestions
├── layout.tsx               # Root layout with providers
├── database/page.tsx        # Database connection management
├── query/page.tsx           # Natural language query interface
├── schema/page.tsx          # Schema explorer with AI descriptions
├── reports/page.tsx         # Reports management (with connection selector)
├── admin/page.tsx           # Admin panel: server connections & assignments
├── landing/                 # Public landing page
│   ├── page.tsx             # Landing page with features/screenshots
│   └── layout.tsx           # Landing layout with SEO metadata
└── api/                     # API routes
    ├── query/
    │   ├── generate/        # Natural language → SQL via OpenAI
    │   ├── execute/         # Execute SQL on connected database
    │   ├── followup/        # Follow-up questions on query results
    │   ├── enhance/         # Enhance vague queries with AI
    │   └── revise/          # Revise failed queries automatically
    ├── schema/
    │   ├── introspect/      # Database schema introspection (POST)
    │   ├── generate-descriptions/  # AI table/column descriptions
    │   ├── upload-schema/   # Upload schema to OpenAI file storage
    │   ├── update-description/     # Manually update descriptions
    │   ├── start-introspection/    # Background introspection process
    │   └── status/          # Poll introspection status
    ├── connection/
    │   └── test/            # Test database connection
    ├── dashboard/
    │   └── suggestions/     # Generate metric suggestions
    ├── chart/
    │   └── generate/        # Generate chart configuration from data
    ├── config/
    │   ├── connections/     # Read server-side database config
    │   ├── rate-limit-status/ # Check rate limit configuration
    │   └── auth-status/     # Check if auth is enabled
    ├── auth/
    │   └── [...nextauth]/   # Auth.js OIDC handler
    ├── data/                # Authenticated CRUD routes
    │   ├── connections/     # GET, POST
    │   ├── connections/[id]/ # GET, PUT, DELETE, POST (duplicate)
    │   ├── schemas/[connectionId]/ # GET, PUT
    │   ├── reports/         # GET, POST
    │   ├── reports/[id]/    # GET, PUT, DELETE
    │   ├── suggestions/[connectionId]/ # GET, PUT
    │   ├── preferences/     # GET, PUT
    │   ├── notifications/dismiss/ # POST
    │   └── import-local/    # POST (localStorage migration)
    ├── sharing/
    │   ├── connections/[id]/ # GET, POST, DELETE
    │   ├── reports/[id]/    # GET, POST, DELETE
    │   └── users/search/    # GET (search by email/name)
    └── admin/
        ├── users/           # GET (list all users)
        ├── server-connections/ # GET, POST (list/create server connections)
        └── server-connections/[id]/
            ├── route.ts     # PUT, DELETE (update/delete server connection)
            ├── assign/      # POST, DELETE
            └── assignments/ # GET

components/                   # React components
├── ui/                      # shadcn/ui components (DO NOT modify manually)
├── charts/                  # Chart implementations (bar, line, pie, area, scatter)
├── schema-explorer.tsx      # Main schema browser component
├── query-results-display.tsx # Results with table/chart views
├── query-tab-content.tsx    # Individual query tab display
├── followup-dialog.tsx      # Follow-up question dialog
├── chart-display.tsx        # Main chart renderer
├── content-loading-gate.tsx # Loading gate until context initialized
├── auth-provider.tsx        # SessionProvider wrapper (conditional)
├── share-dialog.tsx         # Share connections/reports with users
├── data-migration-dialog.tsx # Import localStorage data on first login
├── navigation.tsx           # Top navigation bar (with user menu when auth enabled)
├── saved-reports.tsx        # Reports list with clone/copy-to-connection
├── save-report-dialog.tsx   # Save query as report
├── edit-report-dialog.tsx   # Edit report metadata
├── parameter-config.tsx     # Configure report parameters
├── parameter-input-dialog.tsx # Input parameters when running reports
├── error-boundary.tsx       # React error boundary wrapper
├── openai-api-provider.tsx  # OpenAI API key context provider
├── api-key-dialog.tsx       # API key input dialog
├── api-key-indicator.tsx    # API key status in navigation
├── theme-provider.tsx       # Dark/light theme provider
└── theme-toggle.tsx         # Theme toggle button

lib/                         # Shared utilities
├── database-connection-options.tsx  # Main state management context (uses StorageProvider)
├── utils.ts                 # cn() utility for class names
├── csrf.ts                  # CSRF protection utilities
├── constants.ts             # Centralized app constants
├── server-config.ts         # Server-side config reader
├── api/
│   └── response.ts          # API response helpers (success, error, etc.)
├── auth/                    # Authentication
│   ├── config.ts            # isAuthEnabled() check
│   ├── auth-options.ts      # NextAuth config with OIDC provider
│   └── require-auth.ts      # getAuthContext() + requireAdmin()
├── db/                      # App database (PostgreSQL)
│   ├── pool.ts              # Connection pool (getAppDb())
│   ├── encryption.ts        # AES-256-GCM password encryption
│   ├── migrate.ts           # SQL migration runner
│   ├── migrations/          # SQL migration files
│   │   ├── 001_initial_schema.sql   # Core tables (users, connections, schemas, reports, etc.)
│   │   ├── 002_server_connections.sql # Nullable owner_id, server connection support
│   │   └── 003_cascade_connection_deletes.sql # FK cascades on schemas/reports/suggestions
│   └── repositories/        # Data access layer
│       ├── user-repository.ts
│       ├── connection-repository.ts
│       ├── schema-repository.ts
│       ├── report-repository.ts
│       ├── suggestion-repository.ts
│       ├── preference-repository.ts
│       ├── notification-repository.ts
│       └── sharing-repository.ts
├── storage/                 # Storage abstraction
│   ├── storage-provider.ts  # Interface
│   ├── local-storage-provider.ts  # localStorage impl (default)
│   └── api-storage-provider.ts    # API-backed impl (auth mode)
├── config/
│   └── trusted-proxies.ts   # Trusted proxy configuration
├── openai/
│   └── schema-upload.ts     # Schema upload to OpenAI utilities
└── database/                # Database adapter system
    ├── index.ts             # Re-exports
    ├── types.ts             # Database types and interfaces
    ├── factory.ts           # Adapter factory (registry pattern)
    ├── base-adapter.ts      # Abstract base adapter class
    ├── connection-validator.ts # Connection validation utilities
    ├── adapters/            # Database-specific adapters
    │   ├── postgresql.adapter.ts
    │   ├── mysql.adapter.ts
    │   ├── sqlserver.adapter.ts
    │   └── sqlite.adapter.ts
    └── queries/             # Database-specific SQL queries
        ├── types.ts
        ├── postgresql.queries.ts
        ├── mysql.queries.ts
        ├── sqlserver.queries.ts
        └── sqlite.queries.ts

models/                      # TypeScript interfaces
├── database-connection.interface.ts
├── schema.interface.ts
├── database-table.interface.ts
├── column.interface.ts
├── saved-report.interface.ts  # Report and parameter interfaces
├── chart-config.interface.ts
├── database-context-type.interface.ts
├── connection-form-data.interface.ts # Form data for connections
├── query-tab.interface.ts   # Query tab and follow-up types
└── common-types.ts          # Shared types (CellValue, AISuggestion, etc.)

utils/                       # Utility functions
├── generate-descriptions.ts  # Fallback description generators
├── compare-schemas.ts        # Schema change detection
├── rate-limiter.ts           # IP-based rate limiting
└── error-sanitizer.ts        # Database/OpenAI error sanitization

hooks/                       # Custom React hooks
├── use-mobile.tsx           # Mobile responsive detection
├── use-toast.ts             # Toast notifications
├── use-openai-key.tsx       # OpenAI API key management
├── use-openai-fetch.tsx     # Fetch wrapper with auth/rate-limit
├── use-unsaved-changes.ts   # Unsaved changes tracking
├── use-schema-loading.ts    # Schema introspection state management
└── use-auth.ts              # Authentication state (user, isAdmin, signIn/signOut)

instrumentation.ts           # Next.js 15 startup hook (runs DB migrations)

docs/                        # Developer documentation
├── README.md                # Documentation index
├── architecture/            # System design docs
├── api/                     # API endpoint docs
├── components/              # Component docs
├── models/                  # Data model docs
└── guides/                  # How-to guides

config/                      # Server configuration
├── README.md                # Config documentation
├── databases.json.example   # Example database config
└── databases.json           # Actual config (gitignored)
```

## Important Implementation Details

### Authentication & Multi-User Mode (Optional)
- **Dual-mode**: Auth is disabled by default. Enable by setting `AUTH_OIDC_ISSUER`, `AUTH_OIDC_CLIENT_ID`, `AUTH_OIDC_CLIENT_SECRET`
- **Auth library**: Auth.js v5 (`next-auth`) with generic OIDC provider for Authentik
- **Session strategy**: JWT (no database sessions)
- **Storage abstraction**: `StorageProvider` interface in `lib/storage/`
  - `LocalStorageProvider`: Current behavior, uses localStorage (when auth disabled)
  - `ApiStorageProvider`: Calls `/api/data/*` CRUD routes (when auth enabled)
- **App database**: PostgreSQL via `postgres` npm package, connection pool in `lib/db/pool.ts`
  - Migrations run automatically on startup via `instrumentation.ts`
  - All credentials encrypted with AES-256-GCM (`lib/db/encryption.ts`)
- **Auth context**: All API routes call `getAuthContext(request)` — returns `null` when auth disabled (pass-through), or `{ userId, isAdmin, groups }` when enabled
- **Connection credential resolution**: When auth enabled, `connection-validator.ts` resolves credentials from app DB instead of trusting client-supplied passwords
- **Admin detection**: From Authentik OIDC groups claim, configurable via `AUTH_ADMIN_GROUP` env var
- **Sharing**: Connections and reports can be shared with other users (view/edit/admin permissions)
- **Data migration**: First-login dialog imports localStorage data into user's account

### OpenAI Integration
- Uses **OpenAI Responses API** (not Chat Completions) for query generation
- Schema files are uploaded to OpenAI and stored in a vector store
- Vector store ID is attached to each database connection
- The `file_search` tool is used to provide schema context during query generation
- Model: Configured via `OPENAI_MODEL` environment variable

### Database Connections
- Supports **PostgreSQL, MySQL, SQL Server, and SQLite** via database-specific adapters in `lib/database/adapters/`
- Connection testing is real - the `/api/connection/test` endpoint actually connects and runs a test query
- Connection credentials are stored in localStorage (when auth disabled) or encrypted in PostgreSQL (when auth enabled)
- **Server Configuration**: Connections can be deployed via `config/databases.json` file for team sharing
  - Server connections are automatically loaded on startup
  - Marked with "Server Config" badge in UI
  - Cannot be edited/deleted through UI (read-only)
  - See `config/README.md` for setup instructions
- Each connection has:
  - Basic connection info (host, port, database, username, password)
  - Optional description for business context
  - Optional `schemaFileId` and `vectorStoreId` for OpenAI integration
  - Status: "connected" | "disconnected"
  - Source: "local" | "server" (tracks origin of connection)

### Schema Management
- Schema introspection via POST to `/api/schema/introspect` or WebSocket to `/api/schema/start-introspection`
- Schema data includes tables, columns, data types, constraints, foreign keys
- AI descriptions are generated for tables and columns to improve query accuracy
- Tables/columns can be marked `hidden` to exclude from OpenAI uploads
- Schema change detection marks new/modified items after re-introspection
- **Important**: Schema must be uploaded to OpenAI (creates file + vector store) before queries can be generated

### Query Generation
- Route: `/api/query/generate/route.ts`
- Uses OpenAI Responses API with vector store for schema context
- Only generates SELECT statements for safety
- Returns: `{ sql, explanation, confidence, warnings }`
- Handles non-JSON responses with fallback parsing

### Query Enhancement
- Route: `/api/query/enhance/route.ts`
- Improves vague natural language queries with specific table/column names from schema
- Returns: `{ enhancedQuery, improvements }`

### Query Revision (Self-Correcting)
- Route: `/api/query/revise/route.ts`
- Fixes SQL queries that failed execution by analyzing error messages
- Uses schema context to find correct table/column names
- Returns corrected SQL with explanation

### Follow-Up Questions
- Route: `/api/query/followup/route.ts`
- Processes follow-up questions on query results
- Can return new SQL queries OR text explanations/analysis
- Builds markdown table context from results for AI

### Query Execution
- Route: `/api/query/execute/route.ts`
- Validates queries to prevent dangerous operations (DROP, DELETE, UPDATE, INSERT, etc.)
- Uses database adapters (`lib/database/adapters/`) for database-specific execution
- Returns formatted results with columns, rows, execution time

### Connection Testing
- Route: `/api/connection/test/route.ts`
- Tests database connections by actually connecting and running a test query
- Returns latency and server version information
- Sanitizes errors to prevent credential leaks

### Column Type Detection & Override
- `QueryResultsDisplay` auto-detects column types by sampling the first 10 rows of results
- Supported types: `text`, `number`, `currency`, `date`, `url`, `empty`
- **Currency detection**: Uses column name keyword matching (e.g., `price`, `revenue`, `cost`, `fee`, `salary`) combined with numeric value validation
- **URL detection**: Matches values starting with `http://`, `https://`, or `www.`
- **Manual override**: Users can click the type badge on any column header to change the detected type via a dropdown menu
- Overrides are stored in component state (`columnTypeOverrides`) and reset when new data loads
- Currency values formatted as USD (`$1,234.56`), URLs rendered as clickable links with external link icon

### AI Suggestions
- Dashboard generates metric/report suggestions based on uploaded schema
- Uses vector store to understand schema context
- Suggestions cached in localStorage per connection: `suggestions_{connectionId}`
- Can regenerate additional suggestions on demand

### Saved Reports
- Reports stored in localStorage under `saved_reports` key
- Each report linked to a connection via `connectionId`
- Supports parameterized queries with `{{parameter_name}}` syntax
- Parameter types: `text`, `number`, `date`, `datetime`, `boolean`
- Reports can be exported/imported as JSON

### localStorage Keys
| Key | Description |
|-----|-------------|
| `databaseConnections` | Array of all saved connections |
| `currentDbConnection` | Currently active connection |
| `connectionSchemas` | Array of schemas per connection |
| `saved_reports` | All saved reports |
| `suggestions_{connectionId}` | Cached AI suggestions per connection |
| `dismissed_notifications` | User dismissed notification IDs |

## Environment Variables

Required in `.env.local`:
```
OPENAI_API_KEY=sk-...        # Required for AI features
OPENAI_MODEL=gpt-5          # Model for query generation
DEMO_RATE_LIMIT=             # Optional: number of free requests per 24h per IP (empty = unlimited)
TRUSTED_PROXIES=             # Optional: comma-separated trusted proxy IPs for rate limiting

# Authentication (optional - all 3 required to enable auth mode)
AUTH_OIDC_ISSUER=              # e.g. https://auth.example.com/application/o/dataquery-pro/
AUTH_OIDC_CLIENT_ID=
AUTH_OIDC_CLIENT_SECRET=
AUTH_SECRET=                   # JWT signing key (openssl rand -hex 32)
AUTH_URL=                      # e.g. http://localhost:3000 (required by Auth.js v5)
AUTH_ADMIN_GROUP=dataquery-admins  # Authentik group for admin access

# App Database (required when auth is enabled)
APP_DATABASE_URL=              # e.g. postgres://user:pass@localhost:5432/dataquery_app

# Encryption (required when auth is enabled)
APP_ENCRYPTION_KEY=            # 64-char hex string (openssl rand -hex 32)
```

### Rate Limiting & BYOK (Bring Your Own Key)

The application supports IP-based rate limiting for demo deployments:

- **Environment Variable**: `DEMO_RATE_LIMIT` (integer or unset)
- **When unset/empty**: Rate limiting is disabled (app works normally)
- **When set**: Users are limited to that many OpenAI API requests per 24-hour window per IP address

**User-Provided API Keys**:
- Users can bypass rate limits by providing their own OpenAI API key
- Keys are stored in sessionStorage only (not persisted to localStorage or server)
- Keys are sent in request headers (`x-user-openai-key`) and used directly with OpenAI
- UI indicator in navigation shows key status (green checkmark if configured)

**Implementation Details**:
- Rate limiting: `utils/rate-limiter.ts` - in-memory IP tracking with 24h windows
- Client hook: `hooks/use-openai-key.tsx` - manages user's API key in sessionStorage
- Fetch wrapper: `hooks/use-openai-fetch.tsx` - auto-injects key headers and detects 429 errors
- UI components: `components/api-key-dialog.tsx`, `components/api-key-indicator.tsx`
- Server-side: All OpenAI API routes (`/api/query/generate`, `/api/schema/generate-descriptions`, `/api/dashboard/suggestions`, `/api/chart/generate`) check rate limits and accept user keys

## Common Workflows

### Adding Support for New Database Types
1. Create a new adapter in `lib/database/adapters/` extending `BaseDatabaseAdapter`
2. Register the adapter in `lib/database/factory.ts`
3. Add SQL queries in `lib/database/queries/` for the new database type
4. Update `models/database-connection.interface.ts` type field if needed
5. Add database type option in `app/database/page.tsx` Select component
6. Update SQL generation prompts in `/api/query/generate/route.ts` for dialect

See [docs/guides/adding-database-support.md](./docs/guides/adding-database-support.md) for detailed guide.

### Modifying AI Query Generation
- Edit system prompt in `/api/query/generate/route.ts`
- Ensure schema file is uploaded and vector store ID is available
- The `file_search` tool provides schema context automatically
- Handle vector store 404 errors (stores can expire)

### Adding New UI Components
- This project uses **shadcn/ui** components in `components/ui/`
- Use `components.json` for shadcn configuration
- DO NOT manually edit files in `components/ui/` - regenerate via shadcn CLI
- Add new components: `npx shadcn@latest add [component-name]`

### Working with Context State
```typescript
import { useDatabaseOptions } from '@/lib/database-connection-options';

const {
  currentConnection,    // Active connection
  currentSchema,        // Active schema
  connections,          // All connections
  setCurrentConnection, // Switch connection
  updateConnection,     // Modify connection
  setSchema,           // Save schema
} = useDatabaseOptions();
```

### Adding a New API Endpoint
1. Create route file: `app/api/[endpoint]/route.ts`
2. Export async function for HTTP method (GET, POST, etc.)
3. Use `NextRequest` and `NextResponse` from `next/server`
4. Handle errors with appropriate status codes

## Important Gotchas

1. **Schema Upload Required**: Before generating queries, schema MUST be uploaded to OpenAI via "Upload Schema File" button in database page
2. **LocalStorage Dependencies**: The app heavily relies on localStorage - won't work in SSR contexts
3. **Password Storage**: Passwords are stored in plain text in localStorage (security issue for production)
4. **Context Sync**: When updating connections, always update both the connections array AND currentConnection if it's the active one
5. **Vector Store Pattern**: Each connection maintains its own vector store for schema context - don't share across connections
6. **Vector Store Expiration**: OpenAI vector stores can be deleted or expire - handle 404 errors gracefully
7. **Hidden Items**: Tables/columns marked `hidden: true` are filtered out before uploading to OpenAI
8. **Check isInitialized**: Always check context `isInitialized` before rendering content that depends on loaded data

## TypeScript Notes

- Strict mode enabled
- Path aliases: `@/` maps to project root
- All database-related types defined in `models/` directory
- Use existing interfaces - don't create duplicate types

## Testing

A comprehensive testing plan is available at [docs/testing-plan.md](./docs/testing-plan.md). The plan covers:

- **Phase 1**: Baseline feature tests (all pages and functionality)
- **Phase 2**: Server configuration tests (`config/databases.json`)
- **Phase 3**: Rate limiting and BYOK tests
- **Phase 4**: AI integration quality tests

### Running Tests with Playwright MCP

Tests are designed to run with Playwright MCP for browser automation:

1. Start PostgreSQL container with demo data (see testing plan for commands)
2. Configure environment variables for the test phase
3. Start the dev server
4. Execute tests using Playwright MCP browser tools

### Demo Database Setup

```bash
# Quick start with Podman
podman run -d --name demo-postgres -e POSTGRES_USER=demo -e POSTGRES_PASSWORD=demo -e POSTGRES_DB=cloudmetrics -p 5432:5432 postgres:15
cat scripts/demo-database.sql | podman exec -i demo-postgres psql -U demo -d cloudmetrics
```

Connection: `localhost:5432`, database: `cloudmetrics`, user: `demo`, password: `demo`

## Documentation Reference

| Topic | Documentation |
|-------|---------------|
| System Architecture | [docs/architecture/overview.md](./docs/architecture/overview.md) |
| State Management | [docs/architecture/state-management.md](./docs/architecture/state-management.md) |
| API Endpoints | [docs/api/overview.md](./docs/api/overview.md) |
| Components | [docs/components/overview.md](./docs/components/overview.md) |
| Data Models | [docs/models/overview.md](./docs/models/overview.md) |
| Getting Started | [docs/guides/getting-started.md](./docs/guides/getting-started.md) |
| Authentication Testing | [docs/guides/authentication-testing.md](./docs/guides/authentication-testing.md) |
| OpenAI Integration | [docs/guides/openai-integration.md](./docs/guides/openai-integration.md) |
| Adding Database Support | [docs/guides/adding-database-support.md](./docs/guides/adding-database-support.md) |
| Common Tasks | [docs/guides/common-tasks.md](./docs/guides/common-tasks.md) |
| Testing Plan | [docs/testing-plan.md](./docs/testing-plan.md) |
