# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DataQuery Pro is an AI-powered database visualization and query tool built with Next.js 15, React 19, and TypeScript. The application allows users to connect to PostgreSQL databases, generate AI-powered schema descriptions, and query data using natural language that gets converted to SQL via OpenAI's API.

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
- **Persistence**: All connection data is stored in localStorage (connections, schemas, current connection)
- **Important**: The context manages multiple database connections, current active connection, schema data, and their synchronization with localStorage

### Key Data Flow
1. User creates database connection → stored in localStorage → added to context
2. Schema introspection → uploaded as file to OpenAI → file ID and vector store ID saved to connection
3. AI descriptions generated → schema with descriptions stored in localStorage
4. Natural language query → sent to OpenAI with vector store context → generates SQL
5. SQL execution → postgres library connects and executes → results returned

### Project Structure

```
app/                          # Next.js 15 App Router
├── page.tsx                 # Dashboard with AI suggestions
├── database/page.tsx        # Database connection management
├── query/page.tsx           # Natural language query interface
├── schema/page.tsx          # Schema explorer with AI descriptions
├── reports/page.tsx         # Reports management
└── api/                     # API routes
    ├── query/
    │   ├── generate/        # Natural language → SQL via OpenAI
    │   └── execute/         # Execute SQL on PostgreSQL
    ├── schema/
    │   ├── introspect/      # Database schema introspection
    │   ├── generate-descriptions/  # AI table/column descriptions
    │   ├── upload-schema/   # Upload schema to OpenAI file storage
    │   └── update-description/     # Manually update descriptions
    └── dashboard/
        └── suggestions/     # Generate metric suggestions

components/                   # React components
├── ui/                      # shadcn/ui components (DO NOT modify manually)
├── schema-explorer.tsx      # Main schema browser component
├── query-results-display.tsx
└── navigation.tsx

lib/                         # Shared utilities
└── database-connection-options.tsx  # Main state management context

models/                      # TypeScript interfaces
├── database-connection.interface.ts
├── schema.interface.ts
├── database-table.interface.ts
├── column.interface.ts
└── database-context-type.interface.ts

utils/                       # Utility functions
└── generate-descriptions.ts  # Fallback description generators
```

## Important Implementation Details

### OpenAI Integration
- Uses **OpenAI Responses API** (not Chat Completions) for query generation
- Schema files are uploaded to OpenAI and stored in a vector store
- Vector store ID is attached to each database connection
- The `file_search` tool is used to provide schema context during query generation
- Model: Configured via `OPENAI_MODEL` environment variable

### Database Connections
- Currently **only supports PostgreSQL** via the `postgres` library
- Connection credentials are stored in localStorage (not production-ready)
- Each connection has:
  - Basic connection info (host, port, database, username, password)
  - Optional description for business context
  - Optional `schemaFileId` and `vectorStoreId` for OpenAI integration
  - Status: "connected" | "disconnected"

### Schema Management
- Schema introspection happens via WebSocket connection to `/api/schema/start-introspection`
- Schema data includes tables, columns, data types, constraints, foreign keys
- AI descriptions are generated for tables and columns to improve query accuracy
- Schemas are cached in localStorage with key pattern: `schema_{connectionId}`
- **Important**: Schema must be uploaded to OpenAI (creates file + vector store) before queries can be generated

### Query Generation
- Route: `/api/query/generate/route.ts`
- Uses OpenAI Responses API with vector store for schema context
- Only generates SELECT statements for safety
- Returns: `{ sql, explanation, confidence, warnings }`
- Handles non-JSON responses with fallback parsing

### Query Execution
- Route: `/api/query/execute/route.ts`
- Validates queries to prevent dangerous operations (DROP, DELETE, UPDATE, INSERT, etc.)
- Executes against PostgreSQL using connection credentials
- Returns formatted results with columns, rows, execution time

### AI Suggestions
- Dashboard generates metric/report suggestions based on uploaded schema
- Uses vector store to understand schema context
- Suggestions cached in localStorage per connection: `suggestions_{connectionId}`
- Can regenerate additional suggestions on demand

## Environment Variables

Required in `.env.local`:
```
OPENAI_API_KEY=sk-...        # Required for AI features
OPENAI_MODEL=gpt-4o          # Model for query generation
```

## Common Workflows

### Adding Support for New Database Types
1. Update `models/database-connection.interface.ts` type field
2. Add connection logic in `/api/query/execute/route.ts` (currently hardcoded to postgres)
3. Update schema introspection in `/api/schema/start-introspection/route.ts`
4. Add database type option in `app/database/page.tsx` Select component
5. Update SQL generation prompts in `/api/query/generate/route.ts` for dialect

### Modifying AI Query Generation
- Edit system prompt in `/api/query/generate/route.ts`
- Ensure schema file is uploaded and vector store ID is available
- The `file_search` tool provides schema context automatically

### Adding New UI Components
- This project uses **shadcn/ui** components in `components/ui/`
- Use `components.json` for shadcn configuration
- DO NOT manually edit files in `components/ui/` - regenerate via shadcn CLI

## Important Gotchas

1. **Schema Upload Required**: Before generating queries, schema MUST be uploaded to OpenAI via "Upload Schema File" button in database page
2. **LocalStorage Dependencies**: The app heavily relies on localStorage - won't work in SSR contexts
3. **PostgreSQL Only**: Despite UI showing multiple database types, only PostgreSQL is actually implemented
4. **No Real Connection Testing**: The "Connect Database" button simulates a 2-second delay but doesn't actually test connectivity
5. **Password Storage**: Passwords are stored in plain text in localStorage (security issue for production)
6. **Context Sync**: When updating connections, always update both the connections array AND currentConnection if it's the active one
7. **Vector Store Pattern**: Each connection maintains its own vector store for schema context - don't share across connections

## TypeScript Notes

- Strict mode enabled
- Path aliases: `@/` maps to project root
- All database-related types defined in `models/` directory
- Use existing interfaces - don't create duplicate types
