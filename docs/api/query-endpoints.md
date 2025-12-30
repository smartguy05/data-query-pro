# Query Endpoints

Endpoints for converting natural language to SQL and executing queries.

## POST /api/query/generate

**Location:** `app/api/query/generate/route.ts`

Converts natural language queries to SQL using OpenAI.

### Request

```typescript
interface GenerateRequest {
  query: string;              // Natural language query
  databaseType: string;       // e.g., "PostgreSQL"
  vectorStoreId: string;      // OpenAI vector store ID
  schemaData?: Schema;        // Optional: for auto-reupload
  existingFileId?: string;    // Optional: for cleanup
}
```

### Response

```typescript
// Success
interface GenerateResponse {
  sql: string;              // Generated SQL query
  explanation: string;      // What the query does
  confidence: number;       // 0-1 confidence score
  warnings: string[];       // Potential issues
  // If schema was reuploaded:
  newFileId?: string;
  newVectorStoreId?: string;
  schemaReuploaded?: boolean;
}

// Error
{ "error": "Error message" }
```

### Behavior

1. **Validation**: Checks for required `query` parameter
2. **API Key Check**: Verifies `OPENAI_API_KEY` is set
3. **OpenAI Request**: Uses Responses API with `file_search` tool
4. **Vector Store Recovery**: If vector store 404, attempts automatic reupload
5. **Response Parsing**: Extracts JSON from response, with fallback parsing

### System Prompt

The AI is instructed to:
- Generate only SELECT statements
- Use proper JOIN syntax
- Include appropriate WHERE clauses
- Use LIMIT for large result sets
- Validate tables/columns exist in schema
- Return JSON format only

### Fallback Parsing

If OpenAI returns non-JSON, the endpoint attempts to extract:
- SQL from ```sql code blocks
- SELECT statements directly
- Explanation and confidence from text

### Error Handling

```typescript
// Missing query
{ "error": "Query is required" } // 400

// Missing API key
{ "error": "OpenAI API key not configured" } // 400

// OpenAI API failure
{ "error": "OpenAI API request failed: ..." } // 500

// Fallback mock response on error
{
  "sql": "SELECT table_name, column_name...",
  "explanation": "Shows database schema information...",
  "confidence": 0.3,
  "warnings": ["This is a mock response..."]
}
```

### Example Usage

```typescript
const response = await fetch('/api/query/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "Show me all customers who ordered in the last month",
    databaseType: "PostgreSQL",
    vectorStoreId: "vs_abc123",
    schemaData: currentSchema,
    existingFileId: "file_xyz"
  })
});

const { sql, explanation, confidence, warnings } = await response.json();
```

---

## POST /api/query/execute

**Location:** `app/api/query/execute/route.ts`

Executes SQL queries against PostgreSQL.

### Request

```typescript
interface ExecuteRequest {
  sql: string;                    // SQL query to execute
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
interface ExecuteResponse {
  columns: string[];          // Column names
  rows: string[][];          // Row data (all values as strings)
  rowCount: number;          // Number of rows returned
  executionTime: number;     // Milliseconds to execute
}

// Error
{ "error": "Error message" }
```

### Security Validation

The endpoint blocks dangerous SQL operations:

```typescript
const dangerousKeywords = [
  "DROP", "DELETE", "UPDATE", "INSERT",
  "ALTER", "CREATE", "TRUNCATE"
];
```

Each keyword is checked with word boundaries to avoid false positives.

### Database Connection

Uses the `postgres` library with SSL configuration:

```typescript
const pgClient = postgres({
  host: connection.host,
  port: Number.parseInt(connection.port),
  database: connection.database,
  username: connection.username,
  password: connection.password,
  ssl: connection.host.includes("azure") ? { rejectUnauthorized: false } : false,
});
```

### Result Formatting

- All values converted to strings
- `null` → `"NULL"`
- `Date` → ISO date string (date portion only)
- Numbers → string representation

### Error Messages

Specific error messages for common issues:

```typescript
// Column not found
"Column not found: column \"xyz\" does not exist"

// Table not found
"Table not found: relation \"abc\" does not exist"

// Other errors
error.message
```

### Example Usage

```typescript
const response = await fetch('/api/query/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sql: "SELECT name, email FROM customers LIMIT 10",
    connection: {
      host: "localhost",
      port: "5432",
      database: "mydb",
      username: "user",
      password: "pass"
    }
  })
});

const { columns, rows, rowCount, executionTime } = await response.json();
// columns: ["name", "email"]
// rows: [["John", "john@example.com"], ["Jane", "jane@example.com"]]
```

---

## Query Flow Diagram

```
User Input
    │
    ▼
┌─────────────────────────┐
│ POST /api/query/generate │
├─────────────────────────┤
│ 1. Validate input       │
│ 2. Call OpenAI API      │
│ 3. Parse response       │
│ 4. Return SQL           │
└───────────┬─────────────┘
            │
            ▼
    User reviews SQL
            │
            ▼
┌─────────────────────────┐
│ POST /api/query/execute  │
├─────────────────────────┤
│ 1. Validate SQL safety  │
│ 2. Connect to Postgres  │
│ 3. Execute query        │
│ 4. Format results       │
└───────────┬─────────────┘
            │
            ▼
    Display results
```

## Related Documentation
- [API Overview](./overview.md) - All endpoints
- [OpenAI Integration](../guides/openai-integration.md) - AI details
- [Schema Endpoints](./schema-endpoints.md) - Schema management
