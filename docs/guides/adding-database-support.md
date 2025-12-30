# Adding Database Support

Guide to extending DataQuery Pro for additional database types beyond PostgreSQL.

## Current State

The application currently only supports PostgreSQL despite the UI showing multiple database type options. All database-specific code is hardcoded for PostgreSQL.

## Required Changes

### 1. Update Connection Interface

**File:** `models/database-connection.interface.ts`

Add new type to union or use enum:

```typescript
interface DatabaseConnection {
  // ...
  type: "PostgreSQL" | "MySQL" | "SQLite" | "MSSQL"; // Add new types
  // ...
}
```

### 2. Update Query Execution

**File:** `app/api/query/execute/route.ts`

Add database-specific client initialization:

```typescript
import postgres from "postgres";
import mysql from "mysql2/promise";  // Example for MySQL

export async function POST(request: NextRequest) {
  const { sql, connection } = await request.json();

  // Existing validation...

  let result;

  switch (connection.type) {
    case "PostgreSQL":
      result = await executePostgres(sql, connection);
      break;
    case "MySQL":
      result = await executeMySQL(sql, connection);
      break;
    case "SQLite":
      result = await executeSQLite(sql, connection);
      break;
    default:
      return NextResponse.json(
        { error: `Unsupported database type: ${connection.type}` },
        { status: 400 }
      );
  }

  return NextResponse.json(result);
}

async function executePostgres(sql: string, connection: any) {
  const pgClient = postgres({
    host: connection.host,
    port: Number.parseInt(connection.port),
    database: connection.database,
    username: connection.username,
    password: connection.password,
    ssl: connection.host.includes("azure") ? { rejectUnauthorized: false } : false,
  });

  try {
    const result = await pgClient.unsafe(sql);
    return formatResult(result);
  } finally {
    await pgClient.end();
  }
}

async function executeMySQL(sql: string, connection: any) {
  const conn = await mysql.createConnection({
    host: connection.host,
    port: Number.parseInt(connection.port),
    database: connection.database,
    user: connection.username,
    password: connection.password,
  });

  try {
    const [rows, fields] = await conn.execute(sql);
    return formatMySQLResult(rows, fields);
  } finally {
    await conn.end();
  }
}
```

### 3. Update Schema Introspection

**File:** `app/api/schema/introspect/route.ts`

Add database-specific schema queries:

```typescript
export async function POST(request: Request) {
  const { connection } = await request.json();

  let schema;

  switch (connection.type) {
    case "PostgreSQL":
      schema = await introspectPostgres(connection);
      break;
    case "MySQL":
      schema = await introspectMySQL(connection);
      break;
    case "SQLite":
      schema = await introspectSQLite(connection);
      break;
    default:
      return NextResponse.json(
        { error: `Unsupported database type: ${connection.type}` },
        { status: 400 }
      );
  }

  return NextResponse.json({ success: true, schema });
}

async function introspectPostgres(connection: any) {
  // Existing PostgreSQL introspection logic
  const sql = postgres({ /* ... */ });

  const result = await sql`
    SELECT t.table_name, c.column_name, c.data_type, ...
    FROM information_schema.tables t
    ...
  `;

  // Format and return
}

async function introspectMySQL(connection: any) {
  const conn = await mysql.createConnection({ /* ... */ });

  const [tables] = await conn.execute(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE,
           COLUMN_KEY, EXTRA
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ?
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `, [connection.database]);

  // Format and return
}
```

### 4. Update Database Type Select

**File:** `app/database/page.tsx`

Update the Select component options:

```tsx
<Select
  value={formData.type}
  onValueChange={(value) => setFormData({ ...formData, type: value })}
>
  <SelectTrigger>
    <SelectValue placeholder="Select database type" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="PostgreSQL">PostgreSQL</SelectItem>
    <SelectItem value="MySQL">MySQL</SelectItem>
    <SelectItem value="SQLite">SQLite</SelectItem>
    <SelectItem value="MSSQL">Microsoft SQL Server</SelectItem>
  </SelectContent>
</Select>
```

### 5. Update SQL Generation Prompts

**File:** `app/api/query/generate/route.ts`

The system prompt already accepts `databaseType`. Ensure SQL dialects are handled:

```typescript
const systemPrompt = `
  You are a SQL expert. Convert natural language to SQL using syntax for ${databaseType}.

  Database-specific considerations:
  - PostgreSQL: Use ILIKE for case-insensitive, LIMIT, DATE functions
  - MySQL: Use LIKE LOWER() for case-insensitive, LIMIT, DATE functions
  - SQLite: Use LIKE for case-insensitive, LIMIT, date() functions
  - MSSQL: Use TOP instead of LIMIT, GETDATE() for dates

  ...
`;
```

### 6. Add Database-Specific Dependencies

**File:** `package.json`

Install required database drivers:

```bash
# MySQL
npm install mysql2

# SQLite
npm install better-sqlite3

# MSSQL
npm install tedious
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
