# DataQuery Pro

An AI-powered database visualization and query tool that enables users to interact with their databases using natural language. Supports PostgreSQL, MySQL, SQL Server, and SQLite. Built with Next.js 15, React 19, and powered by OpenAI's API.

## Features

### Natural Language Querying
- Convert plain English questions into SQL queries using AI
- Interactive query editor with syntax highlighting
- Real-time SQL execution with formatted results
- Query confidence scoring and AI-generated explanations
- Safety validations to prevent dangerous operations

### AI-Powered Schema Intelligence
- Automatic database schema introspection
- AI-generated descriptions for tables and columns
- Vector store integration for enhanced context understanding
- Schema visualization and exploration interface

### Smart Dashboard
- AI-generated metric and report suggestions based on your schema
- Quick access to common queries and analytics
- Connection status monitoring
- One-click query execution from suggestions

### Reports Management
- Save queries as reusable reports
- Parameterized reports with dynamic values
- Report library with search and filtering
- Execute saved reports with custom parameters

### Data Visualization
- Multiple chart types: Area, Bar, Line, Pie, and Scatter charts
- AI-powered chart generation from query results
- Interactive and responsive visualizations using Recharts
- Dark/light mode support

### Multi-Database & Multi-Connection Support
- Support for PostgreSQL, MySQL, SQL Server, and SQLite databases
- Manage multiple database connections of different types
- Switch between connections seamlessly
- Connection-specific schema and report storage
- Database-specific SQL dialect generation
- Session-based credential management (sessionStorage)
- Import/Export functionality for settings backup and transfer

### User Experience
- Confirmation dialogs for destructive actions
- Real-time toast notifications
- Responsive design for all screen sizes
- Dark mode support throughout the application

## Tech Stack

- **Framework**: Next.js 15.2.4 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3.4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Databases**:
  - PostgreSQL (via `postgres` library)
  - MySQL (via `mysql2` library)
  - SQL Server (via `mssql` library)
  - SQLite (via `better-sqlite3` library)
- **AI**: OpenAI API with Responses API and Vector Stores
- **Charts**: Recharts 2.15
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ installed
- At least one database to connect to (PostgreSQL, MySQL, SQL Server, or SQLite)
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file in the root directory:
```bash
OPENAI_API_KEY=sk-...        # Required for AI features
OPENAI_MODEL=gpt-4o          # Model for query generation (optional, defaults to gpt-4o)
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Development Commands

```bash
npm run dev          # Start development server on localhost:3000
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run Next.js linter
```

## Usage

### 1. Connect to a Database

1. Navigate to the **Database** page
2. Click "Add New Connection"
3. Select your database type (PostgreSQL, MySQL, SQL Server, or SQLite)
4. Enter your connection details:
   - **Database Type**: Choose from PostgreSQL, MySQL, SQL Server, or SQLite
   - **Connection Name**: A friendly name for this connection
   - **Host**: Server address (e.g., localhost) - not required for SQLite
   - **Port**: Database port (auto-filled based on type: 5432 for PostgreSQL, 3306 for MySQL, 1433 for SQL Server)
   - **Database Name**: Database name or file path (for SQLite)
   - **Username**: Database username
   - **Password**: Database password
   - **Description** (Optional): Business context about the database to improve AI query generation
5. Click "Connect Database"

**Note for SQLite**: Use the full file path to your `.db` file in the "Database Name" field.

### 2. Upload Schema

Before generating queries, you must upload your schema to OpenAI:

1. On the **Database** page, find your connection
2. Click "Upload Schema File"
3. Wait for the schema to be introspected and uploaded
4. The schema will be available in a vector store for AI query generation

### 3. Generate AI Descriptions (Optional)

Enhance query accuracy with AI-generated descriptions:

1. Navigate to the **Schema** page
2. Click "Generate AI Descriptions"
3. AI will analyze your schema and add contextual descriptions to tables and columns
4. These descriptions help the AI understand your database structure better

### 4. Query with Natural Language

1. Navigate to the **Query** page
2. Select your active connection (if you have multiple)
3. Type your question in plain English:
   - "Show me all customers who made purchases over $1000 in the last month"
   - "What are the top 10 selling products by revenue?"
4. Click "Generate SQL Query"
5. Review the generated SQL and confidence score
6. Edit the SQL if needed
7. Click "Execute Query" to run it
8. View results in a formatted table
9. Optionally save the query as a report

### 5. Save and Manage Reports

1. After generating a query, click "Save as Report"
2. Enter a name and description
3. Optionally add parameters for dynamic values
4. Navigate to the **Reports** page to view all saved reports
5. Execute reports with one click or with custom parameter values

### 6. Explore the Dashboard

1. The **Dashboard** page shows AI-generated suggestions
2. Click on any suggestion to navigate to the query page with pre-filled context
3. Regenerate suggestions to get new ideas

### 7. Backup and Restore Settings

Since the application uses sessionStorage, data is cleared when you close the browser tab. Use Import/Export to preserve your settings:

**Export:**
1. Navigate to the **Database** page
2. Click "Export Data"
3. A JSON file will be downloaded containing:
   - All database connections (with credentials)
   - All schemas with AI descriptions
   - Current active connection

**Import:**
1. Navigate to the **Database** page
2. Click "Import Data"
3. Select a previously exported JSON file
4. All connections and schemas will be restored
5. AI descriptions and table metadata are preserved

**Important**: Exported files contain unencrypted database credentials. Store them securely and never commit them to version control.

## Project Structure

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
    ├── dashboard/
    │   └── suggestions/     # Generate metric suggestions
    └── chart/
        └── generate/        # Generate charts from query results

components/                   # React components
├── ui/                      # shadcn/ui components
├── charts/                  # Chart components (Area, Bar, Line, Pie, Scatter)
├── schema-explorer.tsx      # Main schema browser component
├── query-results-display.tsx
├── save-report-dialog.tsx
└── navigation.tsx

lib/                         # Shared utilities
├── database-connection-options.tsx  # Main state management context
└── storage/                 # Storage abstraction layer
    ├── index.ts             # Main storage service export
    ├── storage-interface.ts # Storage adapter interface
    ├── storage-keys.ts      # Centralized storage key management
    ├── session-storage-adapter.ts  # SessionStorage implementation
    ├── memory-storage-adapter.ts   # In-memory fallback adapter
    └── MIGRATION_GUIDE.md   # Guide for future database migration

models/                      # TypeScript interfaces
├── database-connection.interface.ts
├── schema.interface.ts
├── database-table.interface.ts
├── column.interface.ts
└── saved-report.interface.ts

utils/                       # Utility functions
├── database-adapters.ts     # Database-specific query execution
├── schema-introspection-adapters.ts  # Database-specific schema introspection
└── generate-descriptions.ts  # Fallback description generators
```

## State Management

The application uses a centralized React Context pattern with functional state updates to prevent race conditions:

- **Provider**: `DatabaseConnectionOptions` component in `lib/database-connection-options.tsx`
- **Hook**: `useDatabaseOptions()` - use this hook in any component that needs database state
- **Persistence**: Session-scoped storage via abstraction layer (sessionStorage by default)
- **Multi-Connection**: Supports multiple database connections with seamless switching
- **Functional Updates**: All state setters use functional updates to avoid stale closure bugs
- **SSR Compatible**: Storage layer gracefully handles server-side rendering

## Storage Architecture

The application uses a flexible storage abstraction layer that makes it easy to migrate between storage backends:

### Current Implementation
- **Backend**: SessionStorage (browser session-scoped)
- **Security**: Data cleared when browser tab closes
- **Benefits**:
  - More secure than localStorage (session-scoped)
  - Not shared across tabs
  - Reduces credential exposure risk
  - SSR-compatible with graceful fallbacks

### Architecture Components

1. **Storage Interface** (`storage-interface.ts`): Defines the contract for all storage adapters
2. **Storage Service**: Provides type-safe, JSON-based operations with automatic serialization
3. **Storage Keys** (`storage-keys.ts`): Centralized key management to prevent typos
4. **Adapters**:
   - `SessionStorageAdapter`: Production adapter using browser sessionStorage
   - `MemoryStorageAdapter`: Fallback for testing and SSR

### Usage Example

```typescript
import { storage, StorageKeys } from '@/lib/storage'

// Save data with automatic JSON serialization
storage.set(StorageKeys.DATABASE_CONNECTIONS, connections)

// Load data with type safety and default value
const connections = storage.get<DatabaseConnection[]>(
  StorageKeys.DATABASE_CONNECTIONS,
  []
)

// Load optional data (returns null if not found)
const connection = storage.getOptional<DatabaseConnection>(
  StorageKeys.CURRENT_DB_CONNECTION
)
```

### Future Migration

The abstraction layer is designed for easy migration to database storage. See `lib/storage/MIGRATION_GUIDE.md` for detailed instructions on:
- Creating a database storage adapter
- Implementing async storage operations
- Using a hybrid approach (session + database)
- Rollback procedures

### Import/Export

The Database page includes Import/Export functionality to:
- Backup all connections, schemas, and AI descriptions to JSON
- Transfer settings between machines or browsers
- Restore data after clearing browser storage
- Share configurations with team members

**Note**: Exported files may contain database credentials - handle them securely!

## Important Notes

- **Multi-Database Support**: Supports PostgreSQL, MySQL, SQL Server, and SQLite
- **Database-Specific SQL**: AI generates SQL queries using the appropriate dialect for your database type
- **Schema Upload Required**: You must upload your schema to OpenAI before generating queries
- **Session Storage**: Connection credentials and data are stored in browser sessionStorage
- **Data Persistence**: Data is cleared when the browser tab closes (use Export to backup)
- **Security**: Password storage is not encrypted; session-scoped storage reduces exposure risk
- **Vector Stores**: Each connection maintains its own OpenAI vector store for schema context
- **Query Safety**: Only SELECT statements are allowed by default to prevent data modification
- **SQLite Notes**: For SQLite databases, use the file path as the database name; host and port are not required
- **Import/Export**: Use the Export feature to backup your settings before closing the browser tab

## Recent Improvements

### Storage Architecture Overhaul (v2.0)

**Migration from localStorage to sessionStorage:**
- Implemented flexible storage abstraction layer for easy backend switching
- Migrated all storage operations from localStorage to sessionStorage for improved security
- Added SSR-compatible storage adapters with graceful fallbacks
- Centralized storage key management to prevent typos and track all stored data

**Bug Fixes:**
- Fixed critical stale closure bug in React state management that caused data loss during import
- Implemented functional state updates throughout the codebase to prevent race conditions
- Fixed issue where importing multiple database schemas would overwrite each other
- Resolved bug where AI descriptions were lost when importing settings

**Features Added:**
- Import/Export functionality for backing up and restoring all settings
- Support for importing multiple database connections simultaneously
- Preserved AI descriptions and metadata during import/export operations
- Added migration guide for future database storage implementation

**Benefits:**
- More secure: Data cleared when browser tab closes
- No stale closure bugs: Functional updates prevent race conditions
- Easy migration path: Abstraction layer ready for database backend
- Better developer experience: Type-safe storage operations with centralized keys

## Upcoming Features

- Query history and favoriting
- Advanced query builder UI
- Real-time collaboration features
- Optional database backend for persistent storage across sessions