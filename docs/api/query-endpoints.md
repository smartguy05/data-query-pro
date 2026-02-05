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

Executes SQL queries against the connected database.

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

Uses database-specific adapters via the factory pattern:

```typescript
import { DatabaseAdapterFactory } from "@/lib/database";

const adapter = DatabaseAdapterFactory.create(connection.type);
await adapter.connect(config);
const result = await adapter.executeQuery(sql);
await adapter.disconnect();
```

Supported databases: PostgreSQL (`pg`), MySQL (`mysql2`), SQL Server (`mssql`), SQLite (`better-sqlite3`).

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
│ 2. Connect to database  │
│ 3. Execute query        │
│ 4. Format results       │
└───────────┬─────────────┘
            │
            ▼
    Display results
```

---

## POST /api/query/enhance

**Location:** `app/api/query/enhance/route.ts`

Improves natural language queries with specific schema details.

### Request

```typescript
interface EnhanceRequest {
  query: string;              // Original natural language query
  vectorStoreId?: string;     // OpenAI vector store ID for schema context
  databaseType?: string;      // Database type
}
```

### Response

```typescript
interface EnhanceResponse {
  enhancedQuery: string;      // Improved version of input query
  improvements: string[];     // List of improvements made
}
```

### Behavior

1. Takes a vague query (e.g., "show revenue by month")
2. Uses schema context to add specific table/column names
3. Returns enhanced query with detailed instructions about tables, columns, and aggregations
4. Rate limiting and BYOK support

---

## POST /api/query/revise

**Location:** `app/api/query/revise/route.ts`

Fixes SQL queries that failed during execution.

### Request

```typescript
interface ReviseRequest {
  originalQuestion: string;   // User's initial question
  generatedSql: string;       // The SQL that failed
  errorMessage: string;       // Database error message
  databaseType: string;       // Database type
  vectorStoreId?: string;     // Schema context
}
```

### Response

```typescript
interface ReviseResponse {
  sql: string;                // Corrected SQL query
  explanation: string;        // Why it was fixed
  confidence: number;         // 0-1 confidence score
}
```

### Behavior

1. Analyzes the error message from the failed query
2. Searches schema context for correct table/column names
3. Generates corrected SQL addressing the specific error
4. Rate limiting and BYOK support

---

## POST /api/query/followup

**Location:** `app/api/query/followup/route.ts`

Processes follow-up questions on query results.

### Request

```typescript
interface FollowUpRequest {
  followUpQuestion: string;   // User's follow-up question
  originalQuestion: string;   // Initial query
  generatedSql: string;       // SQL that generated results
  resultColumns: string[];    // Column names from results
  resultRows: string[][];     // Result data
  totalRowCount: number;      // Total rows returned
  vectorStoreId?: string;     // Schema context
  databaseType: string;       // Database type
}
```

### Response

```typescript
// Can be one of two types:
interface FollowUpQueryResponse {
  responseType: 'query';
  sql: string;                // New SQL query
  explanation: string;
  confidence: number;
  warnings: string[];
}

interface FollowUpExplanationResponse {
  responseType: 'explanation';
  text: string;               // Analysis/explanation text
  confidence: number;
}
```

### Behavior

1. Builds markdown table context from the original results
2. Determines if follow-up needs a new query or just analysis
3. If query: generates new SQL based on original context + follow-up
4. If explanation: provides analysis text without generating SQL
5. Rate limiting and BYOK support

## Related Documentation
- [API Overview](./overview.md) - All endpoints
- [OpenAI Integration](../guides/openai-integration.md) - AI details
- [Schema Endpoints](./schema-endpoints.md) - Schema management
