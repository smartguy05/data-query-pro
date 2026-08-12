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

# Required by /api/query/generate, /enhance, /revise (no fallback);
# other AI routes fall back to a per-route default
OPENAI_MODEL=gpt-5.6-sol

# Optional - reasoning effort for query generation (empty = provider default)
OPENAI_REASONING_EFFORT=

# Optional - allow the eval harness to override model/effort per request (default off)
EVAL_ALLOW_MODEL_OVERRIDE=
```

### Supported Models
- `gpt-5.6-sol` - Recommended default (best quality)
- `gpt-5.4` - Previous default; faster generation at similar accuracy on the eval set
- `gpt-5.1`, `gpt-5` - Earlier models, lower cost
- `gpt-5-mini` - Fastest, lowest cost

### Reasoning Effort

**Applies to:** `app/api/query/generate/route.ts` only. No other OpenAI route reads it.

`OPENAI_REASONING_EFFORT` sets the `reasoning.effort` passed to the Responses API.

| Aspect | Behavior |
|--------|----------|
| Valid values | `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max` |
| Unset / empty / unrecognized | The `reasoning` key is **omitted from the request entirely** — default provider behavior, unchanged |
| Model support | The `reasoning` parameter is **gpt-5 / o-series models only** (per the openai SDK's own doc comment) |
| Value support | Not every reasoning model supports every value — **OpenAI validates, the SDK does not** |

```typescript
// Omitted entirely when nothing resolves
await client.responses.create({
  model: modelOverride ?? process.env.OPENAI_MODEL,
  ...(resolvedEffort ? { reasoning: { effort: resolvedEffort } } : {}),
  // ...
});
```

> **Gotcha:** an unsupported model/effort pair fails at the OpenAI API, not locally. The
> generate route catches request errors and returns its **HTTP 200 mock fallback**, so a bad
> `OPENAI_REASONING_EFFORT` looks like a mock response (`"This is a mock response…"` warning,
> confidence 0.3) rather than an error. Check the server logs for the real cause.

### Model / Effort Overrides (eval harness only)

The generate route accepts optional `model` and `effort` fields in the request body. **Both are
honored only when the server env `EVAL_ALLOW_MODEL_OVERRIDE=true`; otherwise they are ignored
entirely.** They exist so the eval harness can sweep models and reasoning efforts against one
running server — normal clients should never send them, and the flag should stay off in
production.

With the flag on: a supplied `model` that fails `/^[a-zA-Z0-9._:-]{1,64}$/` returns **HTTP 400**
(no silent fallback to `OPENAI_MODEL`), and an override request (body `model` present) takes its
reasoning effort **from the body only** — `OPENAI_REASONING_EFFORT` is not consulted, so a
variant sent without `effort` measures the provider default.

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

### Request Body

| Field | Required | Purpose |
|-------|----------|---------|
| `query` | Yes | The natural language question |
| `databaseType` | No | Dialect for syntax hints (defaults to `postgresql`) |
| `vectorStoreId` | No | Vector store holding the uploaded schema |
| `schemaData`, `existingFileId` | No | Used to re-upload and retry on a vector store 404 |
| `examples`, `corrections` | No | Learning context (see below) |
| `defaultLimit` | No | User-chosen row limit (`number` or `'none'`) that shapes prompt rule 4 |
| `model` | No | **Eval only** — ignored unless `EVAL_ALLOW_MODEL_OVERRIDE=true`; invalid value → HTTP 400 when the flag is on |
| `effort` | No | **Eval only** — ignored unless `EVAL_ALLOW_MODEL_OVERRIDE=true`; on override requests the env effort is not consulted |

### Response Body

```jsonc
{
  "sql": "SELECT ...",
  "explanation": "tables and columns used",
  "confidence": 0.8,
  "warnings": [],

  // Present only when the schema was re-uploaded after a vector store 404
  "newFileId": "file_...",
  "newVectorStoreId": "vs_...",
  "schemaReuploaded": true,

  // Present when OpenAI reports usage (see Token Usage below)
  "usage": { /* ... */ },

  "rateLimit": { "remaining": 42, "limit": 50 }
}
```

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

### Token Usage

When OpenAI reports usage, the generate response includes a `usage` object for cost accounting:

```typescript
usage: {
  model: string,              // model OpenAI ACTUALLY served
  inputTokens: number,
  cachedInputTokens: number,  // subset of inputTokens
  cacheWriteTokens: number,   // subset of inputTokens
  outputTokens: number,
  reasoningTokens: number,    // subset of outputTokens
  totalTokens: number,
}
```

**Subset semantics — these are breakdowns, never additive:**
- `reasoningTokens` is a **subset of** `outputTokens` (do not add them)
- `cachedInputTokens` and `cacheWriteTokens` are **subsets of** `inputTokens`

`usage.model` is the ID OpenAI actually used, which is typically a **dated snapshot** of the
requested alias (e.g. requesting `gpt-5.4` reports back something like `gpt-5.4-2026-03-05`).
Attribute cost to this value, not to the alias you asked for.

> This applies to the **generate route only**. The other OpenAI routes (enhance, revise,
> followup, suggestions, generate-descriptions, chart) do not surface usage.

### Learning From Previous Queries

The query-generation prompt is augmented with two **optional, guarded** sections built
from the client's device-local history (the "learn from previous queries" feature). When
no history exists, these sections are empty strings and the base prompt is byte-identical.

**Data flow:**
1. Client (`app/query/page.tsx` → `buildLearningContext()`) gathers relevance-matched
   successful examples (same DB type) plus failed→revised corrections for the current
   schema fingerprint, and sends them as `examples` and `corrections` in the request body.
2. Server (`app/api/query/generate/route.ts` → `buildLearningSections(examples, corrections)`)
   renders them into two prompt sections appended after the database-specific syntax hints.

**Injected sections:**
- **`# Proven examples for this schema`** — past natural-language questions and the SQL
  that successfully ran. Guidance for table/column names and query patterns; the schema
  file remains the only source of truth if an example conflicts.
- **`# Known corrections — avoid these mistakes`** — failed→revised SQL pairs so the model
  does not repeat past mistakes (especially wrong table/column names).

**Caps (from `lib/constants.ts`):**

| Constant | Value | Purpose |
|----------|-------|---------|
| `AI.MAX_FEW_SHOT` | 4 | Past successful queries injected as few-shot examples |
| `AI.MAX_CORRECTIONS` | 2 | Failed→revised corrections injected as anti-mistake hints |
| `CORRECTIONS.MAX_ENTRIES` | 50 | Device-local correction ring-buffer size |
| `CORRECTIONS.MAX_POOL_FETCH` | 200 | Corrections fetched from the team-wide pool per fingerprint (auth mode) |

> Phase 2 (auth mode only) pools failed→revised corrections team-wide by `schema_fingerprint`
> via `/api/data/corrections`. The captured pool feeds the same `corrections` payload above.
> See the learning curation UI at `/learning` (`app/learning/page.tsx`).

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
- Use `gpt-5.6-sol` for complex queries
- Use a smaller model (e.g. `gpt-5-mini`) for simple descriptions
- Consider model per endpoint

### Measuring Cost Per Model

Per-model accuracy, latency, and cost measurement lives in the standalone NL→SQL eval harness
(`evals/`, run with `pnpm eval`). It sweeps models and reasoning efforts, uses the generate
route's `usage` field for token accounting, and prices it from `evals/pricing.json` (which ships
with unset rates, so cost renders as `—` until you fill them in).

See [evals/README.md](../../evals/README.md) for setup and usage.

---

## Related Documentation
- [Query Endpoints](../api/query-endpoints.md) - Query API details
- [Schema Endpoints](../api/schema-endpoints.md) - Schema API details
- [Dashboard Endpoints](../api/dashboard-endpoints.md) - Suggestions API
- [Eval Harness](../../evals/README.md) - NL→SQL accuracy, latency, and cost measurement
