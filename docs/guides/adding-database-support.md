# Adding Database Support

Guide to extending DataQuery Pro for additional database types beyond PostgreSQL.

## Current State

The application supports **all four database types**: PostgreSQL, MySQL, SQL Server, and SQLite. Each database has a dedicated adapter implementing the `IDatabaseAdapter` interface, with database-specific SQL queries for introspection.

### Implemented Architecture

```
lib/database/
├── types.ts              # DatabaseType, IDatabaseAdapter interface
├── base-adapter.ts       # Abstract BaseDatabaseAdapter class
├── factory.ts            # DatabaseAdapterFactory (registry pattern)
├── connection-validator.ts # Connection validation utilities
├── adapters/
│   ├── postgresql.adapter.ts  # Uses 'pg' library
│   ├── mysql.adapter.ts       # Uses 'mysql2/promise'
│   ├── sqlserver.adapter.ts   # Uses 'mssql'
│   └── sqlite.adapter.ts      # Uses 'better-sqlite3'
└── queries/
    ├── types.ts               # ParameterizedQuery interface
    ├── postgresql.queries.ts
    ├── mysql.queries.ts
    ├── sqlserver.queries.ts
    └── sqlite.queries.ts
```

### Adding a New Database Type

To add support for a new database (e.g., Oracle, CockroachDB):

## Required Changes

### 1. Create Database Adapter

**File:** `lib/database/adapters/[newdb].adapter.ts`

Extend `BaseDatabaseAdapter`:

```typescript
import { BaseDatabaseAdapter } from '../base-adapter';
import type { AdapterConnectionConfig, QueryResult, IntrospectionResult } from '../types';

export class NewDbAdapter extends BaseDatabaseAdapter {
  readonly type = 'newdb';
  readonly displayName = 'NewDB';
  readonly defaultPort = 1234;

  async connect(config: AdapterConnectionConfig): Promise<void> { /* ... */ }
  async disconnect(): Promise<void> { /* ... */ }
  async executeRawQuery(sql: string): Promise<QueryResult> { /* ... */ }
  async executeParameterizedQuery(query: ParameterizedQuery): Promise<QueryResult> { /* ... */ }
}
```

### 2. Add Query Definitions

**File:** `lib/database/queries/[newdb].queries.ts`

Define introspection queries:

```typescript
import type { ParameterizedQuery } from './types';

export const newdbQueries = {
  getTables(): ParameterizedQuery { /* ... */ },
  getColumns(tableName: string): ParameterizedQuery { /* ... */ },
  getForeignKeys(): ParameterizedQuery { /* ... */ },
  testConnection(): ParameterizedQuery { /* ... */ },
};
```

### 3. Register the Adapter

**File:** `lib/database/factory.ts`

```typescript
import { NewDbAdapter } from './adapters/newdb.adapter';

DatabaseAdapterFactory.register('newdb', NewDbAdapter);
```

### 4. Update Type Definitions

**File:** `lib/database/types.ts`

Add to the `DatabaseType` union:

```typescript
export type DatabaseType = 'postgresql' | 'mysql' | 'sqlserver' | 'sqlite' | 'newdb';
```

### 5. Update UI

**File:** `app/database/page.tsx`

Add the new database type to the Select component and set default port.

### 6. Update SQL Generation Prompts

**File:** `app/api/query/generate/route.ts`

Add dialect-specific hints for the new database type in the SQL hints section.

### 7. Add Dependencies

```bash
npm install [newdb-driver-package]
```

## Schema Query Reference

### PostgreSQL
```sql
SELECT t.table_name, c.column_name, c.data_type, c.is_nullable
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
```

### MySQL
```sql
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
```

### SQLite
```sql
SELECT name FROM sqlite_master WHERE type='table';
-- Then for each table:
PRAGMA table_info(table_name);
```

### MSSQL
```sql
SELECT t.name AS table_name, c.name AS column_name,
       ty.name AS data_type, c.is_nullable
FROM sys.tables t
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
```

## Testing New Database Types

1. Create test database with sample data
2. Add connection in UI
3. Test introspection
4. Test AI descriptions generation
5. Upload schema to OpenAI
6. Test natural language queries
7. Verify query execution

## Considerations

### Connection Strings
Different databases have different connection string formats:
- PostgreSQL: `postgresql://user:pass@host:port/db`
- MySQL: `mysql://user:pass@host:port/db`
- SQLite: File path only
- MSSQL: `mssql://user:pass@host:port/db`

### SSL/TLS
Each database has different SSL configuration options.

### Port Defaults
- PostgreSQL: 5432
- MySQL: 3306
- MSSQL: 1433
- SQLite: N/A (file-based)

### Type Mapping
Map database-specific types to common display types for consistency.

---

## Related Documentation
- [Getting Started](./getting-started.md) - Setup guide
- [Query Endpoints](../api/query-endpoints.md) - Query API
- [Schema Endpoints](../api/schema-endpoints.md) - Schema API
