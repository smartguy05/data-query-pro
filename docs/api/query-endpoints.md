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
  examples?: { question?: string; sql?: string }[];                        // Optional: proven few-shot examples (learning)
  corrections?: { question?: string; badSql?: string; error?: string; goodSql?: string }[]; // Optional: failed→fixed corrections (learning)
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

### Learning Prompt Sections ("Learn from previous queries")

When the client sends `examples` and/or `corrections` (device-local query history,
keyed by schema fingerprint), `buildLearningSections()` renders two optional,
guarded sections into the system prompt:

- **Proven examples for this schema** — past question/SQL pairs that ran successfully,
  used as guidance for table/column names and query patterns.
- **Known corrections — avoid these mistakes** — previously failed queries and their
  corrected versions, so the model avoids repeating wrong table/column names.

Both sections are omitted entirely when no history is supplied, so the base prompt is
byte-identical with no learning data. Server-side the arrays are defensively capped
(examples sliced to 6, corrections to 4); the client sends at most `AI.MAX_FEW_SHOT`
(4) examples and `AI.MAX_CORRECTIONS` (2) corrections (`lib/constants.ts`). The schema
file remains the only source of truth — examples/corrections never override it.

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
  // No-auth mode: full connection object (credentials supplied by client)
  connection?: {
    host: string;
    port: string;
    database: string;
    username: string;
    password: string;
  };
  // Auth mode: credentials resolved server-side from the app DB
  connectionId?: string;
  source?: "local" | "server";
  type?: string;
  // Optional audit-log metadata (never required)
  question?: string;              // Natural-language prompt behind the SQL
  querySource?: string;           // e.g. "report", "followup"
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

### Security Validation (AST-based)

Validation runs through `validateReadOnlySql(sql, dbType)` in
`lib/database/sql-validator.ts`, which **replaced** the old regex keyword blocklist
(`DANGEROUS_SQL_KEYWORDS`). The old list was trivially bypassable via comments,
write-via-function, or stacked statements.

```typescript
import { validateReadOnlySql } from "@/lib/database/sql-validator";

const sqlCheck = validateReadOnlySql(sql, dbType);
if (!sqlCheck.valid) {
  return NextResponse.json({ error: sqlCheck.error }, { status: 400 });
}
```

Two layers:

1. **AST (primary)** — parses the SQL with `node-sql-parser` (dependency `^5.4.0`)
   using the per-dialect grammar (`postgresql` / `mysql` / `transactsql` / `sqlite`).
   Requires exactly **one** statement of type `SELECT` (CTEs included); anything else
   (multiple statements, non-SELECT) is rejected.
2. **Heuristic fallback** — when the parser throws (its grammars reject some valid
   SQL), `heuristicReadOnly()` strips comments/strings/quoted identifiers, then
   requires a single statement starting with `SELECT`/`WITH` and containing no
   write/DDL keyword (blocks stacked statements, data-modifying CTEs, `SELECT INTO`).

### Read-Only Execution Enforcement

Defense-in-depth: after validation the route sets `config.readOnly = true`, so the
adapter runs the query in a read-only context even if a write slipped past the
validator:

- **PostgreSQL** — read-only transaction
- **MySQL** — read-only transaction + ROLLBACK
- **SQL Server** — wrapped statement, always ROLLBACK
- **SQLite** — connection opened with `readonly: true`

The `readOnly` flag is also set by `/api/schema/sample-data`. Schema introspection
intentionally stays writable (internal callers leave the flag unset).

### Audit Logging

Every execution (success and failure) is recorded via fire-and-forget
`logQuery()` (`lib/query-log.ts`). It writes to the app DB table `query_log`
(migration `005_query_log.sql`) when the app DB is enabled, otherwise to
`logs/query-log.jsonl` (`lib/query-log-file.ts`). Credentials are **never** logged —
`QueryLogEntry` has no field for them. Logged fields include user/connection id,
database type, SQL, optional `question`/`source`, row count, duration, and (on
failure) the sanitized error.

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
│ 1. AST read-only check  │
│ 2. Connect (read-only)  │
│ 3. Execute query        │
│ 4. Log + format results │
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
