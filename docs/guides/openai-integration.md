# OpenAI Integration

Guide to the OpenAI API integration for natural language queries and AI features.

## Overview

DataQuery Pro uses OpenAI for:
1. **Query Generation** - Natural language to SQL conversion
2. **AI Descriptions** - Generate table/column descriptions
3. **Suggestions** - Generate metric and report suggestions
4. **Chart Configuration** - Suggest chart types from data

## API Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional (defaults to gpt-5.1)
OPENAI_MODEL=gpt-5.1
```

### Supported Models
- `gpt-5.1` - Recommended for best quality
- `gpt-5` - Faster, slightly lower quality
- `gpt-5-mini` - Fastest, lowest cost

## Responses API

DataQuery Pro uses the **OpenAI Responses API** (not Chat Completions):

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const response = await client.responses.create({
  model: process.env.OPENAI_MODEL,
  tools: [{ type: "file_search", vector_store_ids: [vectorStoreId] }],
  input: [
    { role: "system", content: "System prompt..." },
    { role: "user", content: "User query..." }
  ]
});

if (response.status === "completed") {
  const output = response.output_text;
}
```

### Key Differences from Chat Completions
- Uses `input` instead of `messages`
- Returns `output_text` instead of `choices[0].message.content`
- Status can be `completed`, `failed`, etc.
- Native tool support with `file_search`

## Vector Store Integration

### Creating a Vector Store

When schema is uploaded:

```typescript
// 1. Upload schema file
const file = await client.files.create({
  file: jsonFile,
  purpose: 'user_data'
});

// 2. Create vector store with file
const vectorStore = await client.vectorStores.create({
  name: "Database schema store",
  file_ids: [file.id]
});

// 3. Store IDs on connection
connection.schemaFileId = file.id;
connection.vectorStoreId = vectorStore.id;
```

### Using Vector Store in Queries

```typescript
const response = await client.responses.create({
  model: process.env.OPENAI_MODEL,
  tools: [{
    type: "file_search",
    vector_store_ids: [connection.vectorStoreId]
  }],
  input: [/* ... */]
});
```

The `file_search` tool allows the AI to search the schema file for relevant context.

### Vector Store Lifecycle

1. **Creation** - When schema is uploaded
2. **Usage** - Referenced in query generation
3. **Cleanup** - Deleted when new schema uploaded
4. **Expiration** - May expire after inactivity (handle 404)

### Handling Vector Store 404

Vector stores can be deleted or expire. Handle gracefully:

```typescript
try {
  response = await makeOpenAIRequest(vectorStoreId);
} catch (error) {
  if (error.message.includes("Vector store") && error.message.includes("not found")) {
    // Re-upload schema and retry
    const { fileId, vectorStoreId } = await uploadSchema(schemaData);
    response = await makeOpenAIRequest(vectorStoreId);
  }
}
```

## Query Generation

**File:** `app/api/query/generate/route.ts`

### System Prompt

```typescript
const systemPrompt = `
# Role
You are a SQL expert. Convert natural language to SQL for ${databaseType}.

# Rules
1. Only generate SELECT statements for safety
2. Use proper JOIN syntax when needed
3. Include appropriate WHERE clauses
4. Use LIMIT for large result sets
5. Validate tables and columns exist in schema
6. Use descriptions to understand business context
7. Prefer meaningful column aliases

# Response Format
Return JSON only:
{
  "sql": "generated SQL",
  "explanation": "what it does",
  "confidence": 0.8,
  "warnings": ["any issues"]
}
`;
```

### Response Parsing

The endpoint handles various response formats:

```typescript
try {
  // Try direct JSON parse
  const result = JSON.parse(response.output_text);
  return result;
} catch {
  // Try extract from code block
  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }

  // Try extract SQL directly
  const sqlMatch = output.match(/```sql\s*([\s\S]*?)\s*```/i);
  if (sqlMatch) {
    return {
      sql: sqlMatch[1],
      explanation: "Extracted from response",
      confidence: 0.5,
      warnings: ["Response was not JSON"]
    };
  }
}
```

## AI Descriptions

**File:** `app/api/schema/generate-descriptions/route.ts`

### Table Description Prompt

```typescript
const tablePrompt = `
You are a database analyst helping to document a business database.

BUSINESS CONTEXT: ${databaseDescription}

DATABASE TABLE ANALYSIS:
Table Name: ${table.name}
Columns: ${columnList}

TASK: Write a clear, business-focused description (1-2 sentences) explaining:
1. What business data this table stores
2. Its role in the overall system

Focus on business value, not technical details.
`;
```

### Column Description Prompt

```typescript
const columnPrompt = `
You are documenting a database column for business users.

TABLE CONTEXT: ${table.name} - ${table.aiDescription}

COLUMN DETAILS:
- Name: ${column.name}
- Data Type: ${column.type}
- Role: ${isPK ? "PRIMARY KEY" : isFk ? "FOREIGN KEY → " + fk : ""}

TASK: Write a concise, business-focused description (1 sentence).
`;
```

### Rate Limit Handling

```typescript
async function callOpenAIWithRetry(prompt: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await client.responses.create({ /* ... */ });

      if (response.status === "completed") {
        return response.output_text;
      }

      if (response.error?.code === "rate_limit_exceeded") {
        const waitTime = Math.pow(2, attempt) * 2000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}
```

## Suggestions Generation

**File:** `app/api/dashboard/suggestions/route.ts`

### System Prompt

```typescript
const systemPrompt = `
# Role
You are a business intelligence expert.

# Instructions
Based on the database schema, suggest 6 valuable business metrics.

For each suggestion, provide:
1. Clear title
2. Brief description
3. Natural language query
4. Category (Performance, Customer, Financial, etc.)
5. Array of relevant table names

Format as JSON array.

# Critical
1. Use ONLY tables/columns from the schema
2. NEVER guess names
`;
```

## Fallback Generators

When OpenAI is unavailable, use local fallbacks:

**File:** `utils/generate-descriptions.ts`

```typescript
export function generateTableDescription(
  tableName: string,
  columns: Column[],
  context?: string
): string {
  // Pattern-based description generation
  if (tableName.includes("user")) {
    return "Stores user account information...";
  }
  // More patterns...
}

export function generateColumnDescription(
  tableName: string,
  columnName: string,
  type: string,
  isPrimaryKey?: boolean,
  foreignKey?: string,
  context?: string
): string {
  if (isPrimaryKey) {
    return `Unique identifier for ${tableName} records`;
  }
  // More patterns...
}
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 | Invalid API key | Check OPENAI_API_KEY |
| 404 Vector store | Store deleted/expired | Re-upload schema |
| 429 Rate limit | Too many requests | Implement backoff |
| 500 | OpenAI service error | Retry with backoff |

### Error Response Pattern

```typescript
try {
  const response = await client.responses.create({ /* ... */ });
} catch (error) {
  console.error("OpenAI error:", error);

  // Return fallback or error
  return NextResponse.json({
    error: "AI service unavailable",
    fallback: true,
    data: generateFallbackData()
  });
}
```

## Cost Optimization

### Reduce Token Usage
- Filter hidden tables/columns before upload
- Use concise prompts
- Limit schema file size
- Cache suggestions in localStorage

### Model Selection
- Use `gpt-5.1` for complex queries
- Use `gpt-5.1` for simple descriptions
- Consider model per endpoint

---

## Related Documentation
- [Query Endpoints](../api/query-endpoints.md) - Query API details
- [Schema Endpoints](../api/schema-endpoints.md) - Schema API details
- [Dashboard Endpoints](../api/dashboard-endpoints.md) - Suggestions API
