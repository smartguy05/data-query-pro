# Schema Endpoints

Endpoints for database schema introspection, OpenAI upload, and AI description generation.

## POST /api/schema/introspect

**Location:** `app/api/schema/introspect/route.ts`

Retrieves database schema from PostgreSQL.

### Request

```typescript
interface IntrospectRequest {
  connection: {
    host: string;
    port: string;
    database: string;
    username: string;
    password: string;
  };
}
```

### Response

```typescript
// Success
{
  "success": true,
  "schema": {
    "tables": [
      {
        "name": "customers",
        "aiDescription": "Table containing customers data",
        "columns": [
          {
            "name": "id",
            "type": "integer",
            "nullable": false,
            "primary_key": true,
            "foreign_key": null,
            "aiDescription": "id field of type integer"
          }
        ]
      }
    ]
  }
}

// Error
{ "error": "Failed to introspect schema: <message>" }
```

### SQL Query

Queries `information_schema` for:
- All tables in `public` schema
- Column names, types, nullability
- Primary key constraints
- Foreign key relationships

```sql
SELECT
  t.table_name, c.column_name, c.data_type, c.is_nullable,
  CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
  CASE WHEN fk.column_name IS NOT NULL THEN fk.foreign_table_name || '.' || fk.foreign_column_name ELSE NULL END as foreign_key
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
-- ... constraint joins ...
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
```

### GET Method

Returns empty schema (legacy/placeholder):

```typescript
{ "success": true, "schema": { "tables": [] } }
```

---

## POST /api/schema/upload-schema

**Location:** `app/api/schema/upload-schema/route.ts`

Uploads schema to OpenAI for vector store indexing.

### Request

```typescript
interface UploadRequest {
  data: Schema;                  // Schema to upload
  existingFileId?: string;       // Previous file to delete
  existingVectorStoreId?: string; // Previous vector store to delete
}
```

### Response

```typescript
// Success
{
  "fileId": "file-abc123",
  "vectorStoreId": "vs-xyz789"
}

// Error
{ "error": "Failed to upload schema file" }
```

### Behavior

1. **Filter Hidden Items**: Removes tables/columns marked `hidden: true`
2. **Delete Previous**: Attempts to delete existing file and vector store
3. **Create File**: Uploads JSON as `database-schema.json`
4. **Create Vector Store**: Creates store with file attached

```typescript
// Filter hidden items
const filteredData = {
  ...data,
  tables: data.tables
    .filter((table) => !table.hidden)
    .map((table) => ({
      ...table,
      columns: table.columns.filter((column) => !column.hidden)
    }))
};

// Upload to OpenAI
const file = await openai.files.create({
  file: jsonFile,
  purpose: 'user_data'
});

const vectorStore = await openai.vectorStores.create({
  name: "Database schema store",
  file_ids: [file.id]
});
```

### Important Notes

- Requires `OPENAI_API_KEY` environment variable
- IDs should be saved to connection for later use
- Each connection should have its own vector store

---

## POST /api/schema/generate-descriptions

**Location:** `app/api/schema/generate-descriptions/route.ts`

Generates AI descriptions for tables and columns.

### Request

```typescript
interface GenerateDescriptionsRequest {
  schema: Schema;
  databaseDescription?: string;   // Business context
  batchInfo?: {
    current: number;
    total: number;
    tableNames: string[];
  };
}
```

### Response

```typescript
// Success
{
  "success": true,
  "schema": {
    "connectionId": "...",
    "tables": [
      {
        "name": "customers",
        "aiDescription": "Stores customer profile information...",
        "columns": [
          {
            "name": "email",
            "aiDescription": "Customer's primary email address..."
          }
        ]
      }
    ]
  }
}

// Error
{ "success": false, "error": "Failed to generate descriptions" }
```

### Behavior

1. **Check API Key**: If no key, uses fallback generators
2. **Process Tables**: Iterates through tables without `aiDescription`
3. **Generate Table Description**: Prompts AI for business-focused description
4. **Generate Column Descriptions**: Prompts AI for each column
5. **Rate Limit Handling**: Exponential backoff on rate limits

### AI Prompts

**Table Description:**
```
You are a database analyst helping to document a business database.
BUSINESS CONTEXT: {databaseDescription}
DATABASE TABLE ANALYSIS:
Table Name: {table.name}
Columns: {column list with types and constraints}

TASK: Write a clear, business-focused description (1-2 sentences)...
```

**Column Description:**
```
You are documenting a database column for business users.
TABLE CONTEXT: {table.name} - {table.aiDescription}
COLUMN DETAILS:
- Name: {column.name}
- Data Type: {column.type}
- Role: PRIMARY KEY / FOREIGN KEY / etc.

TASK: Write a concise, business-focused description (1 sentence)...
```

### Fallback Generators

When OpenAI is unavailable, uses `utils/generate-descriptions.ts`:
- `generateTableDescription(name, columns, context)`
- `generateColumnDescription(table, column, type, pk, fk, context)`

---

## POST /api/schema/update-description

**Location:** `app/api/schema/update-description/route.ts`

Updates a single table or column description.

### Request

```typescript
interface UpdateDescriptionRequest {
  tableName: string;
  columnName?: string;  // If updating column, otherwise table
  description: string;
  type: 'table' | 'column';
}
```

### Response

```typescript
// Success
{ "success": true }

// Error
{ "error": "Table/Column not found" }
```

---

## WebSocket: /api/schema/start-introspection

**Location:** `app/api/schema/start-introspection/route.ts`

Real-time schema introspection with progress updates.

### Connection

```typescript
const ws = new WebSocket('/api/schema/start-introspection');
```

### Messages Received

```typescript
// Progress update
{ "type": "progress", "message": "Connecting to database...", "progress": 10 }
{ "type": "progress", "message": "Querying tables...", "progress": 30 }

// Completion
{ "type": "complete", "schema": {...}, "progress": 100 }

// Error
{ "type": "error", "message": "Connection failed" }
```

---

## GET /api/schema/status

**Location:** `app/api/schema/status/route.ts`

Polls introspection status (alternative to WebSocket).

### Response

```typescript
{
  "status": "in_progress" | "complete" | "error",
  "progress": 50,
  "message": "Processing tables...",
  "schema": {...}  // Only on complete
}
```

---

## Schema Flow Diagram

```
Database Connection Created
            │
            ▼
┌──────────────────────────┐
│ POST /schema/introspect   │
│ - Query PostgreSQL        │
│ - Extract tables/columns  │
└───────────┬──────────────┘
            │
            ▼
    Schema cached in context
            │
            ▼
┌────────────────────────────────┐
│ POST /schema/generate-descriptions │
│ - Generate AI descriptions      │
│ - Save to schema               │
└───────────┬────────────────────┘
            │
            ▼
    User reviews/edits
            │
            ▼
┌──────────────────────────┐
│ POST /schema/upload-schema │
│ - Upload to OpenAI        │
│ - Create vector store     │
└───────────┬──────────────┘
            │
            ▼
    Store fileId & vectorStoreId
    in connection metadata
            │
            ▼
    Ready for query generation
```

## Related Documentation
- [API Overview](./overview.md) - All endpoints
- [OpenAI Integration](../guides/openai-integration.md) - Vector store details
- [Query Endpoints](./query-endpoints.md) - Using schema for queries
