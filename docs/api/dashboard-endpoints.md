# Dashboard Endpoints

Endpoints for AI suggestions and chart generation.

## POST /api/dashboard/suggestions

**Location:** `app/api/dashboard/suggestions/route.ts`

Generates AI-powered metric and report suggestions based on database schema.

### Request

```typescript
interface SuggestionsRequest {
  connectionId: string;
  vectorStoreId: string;
}
```

### Response

```typescript
// Success
{
  "suggestions": [
    {
      "title": "Monthly Revenue Trend",
      "description": "Tracks revenue growth over the past 12 months",
      "query": "Show me the monthly revenue for the past year",
      "category": "Financial",
      "relevantTables": ["orders", "order_items"]
    }
  ],
  "rateLimit": { "remaining": 9, "limit": 10 }
}

// Error - Rate limit exceeded (429)
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Demo rate limit exceeded. Please provide your own OpenAI API key to continue.",
  "limit": 10,
  "remaining": 0,
  "resetTime": 1234567890
}

// Error - Vector store not found (404)
{
  "error": "VECTOR_STORE_NOT_FOUND",
  "details": "The vector store for this connection no longer exists...",
  "needsReupload": true
}

// Error - Other (500)
{
  "error": "Failed to generate suggestions",
  "details": "Error message"
}
```

### Behavior

1. **Check Rate Limit**: Return `429 RATE_LIMIT_EXCEEDED` when the demo limit is hit
2. **Validate Input**: Check `connectionId` and `vectorStoreId` present
3. **Check API Key**: Resolve user-provided key or `OPENAI_API_KEY`; return error if missing
4. **Call OpenAI**: Use Responses API with `file_search` tool
5. **Parse Response**: Extract JSON array of suggestions (falls back to `[]` on parse failure)
6. **Handle Vector Store 404**: Return special error for reupload flow

### AI System Prompt

```
# Role
You are a business intelligence expert.

# INSTRUCTIONS
Based on the database schema found in the uploaded file, suggest 6 valuable
business metrics, reports, or analyses. For each suggestion, identify which
specific tables would be needed.

For each suggestion, provide:
1. A clear title
2. A brief description of what insight it provides
3. A natural language query that could generate this metric
4. A category (Performance, Customer, Financial, Operational, etc.)
5. An array of relevant table names

# CRITICAL INSTRUCTIONS
1. Use only table names and columns found in the supplied schema file.
2. NEVER guess column or table names
```

### Categories

Suggestions are categorized as:
- **Performance** - System/business performance metrics
- **Customer** - Customer-related analytics
- **Financial** - Revenue, costs, profitability
- **Operational** - Process and operations metrics
- **Sales** - Sales-specific metrics
- **Inventory** - Stock and inventory tracking

### Client-Side Caching

Suggestions are cached in localStorage:

```typescript
// Cache key pattern
const key = `suggestions_${connectionId}`;

// Save
localStorage.setItem(key, JSON.stringify(suggestions));

// Load
const cached = JSON.parse(localStorage.getItem(key) || '[]');
```

---

## POST /api/chart/generate

**Location:** `app/api/chart/generate/route.ts`

Generates chart configuration from query results.

### Request

```typescript
interface ChartGenerationRequest {
  columns: string[];                 // Column names from query
  rows: DataRows;                    // Query result data
  rowCount: number;                  // Total number of rows
  preferredChartType?: ChartType;    // Optional user-preferred chart type
}
```

See `models/chart-config.interface.ts` for the exact `ChartGenerationRequest` /
`ChartGenerationResponse` / `ChartConfig` types.

### Response

```typescript
// Success — shape varies by chart type (see ChartConfig union)
{
  "config": {
    "type": "bar",                  // bar | line | pie | area | scatter | composed
    "title": "Chart title",
    "description": "Optional explanation",
    "xAxisColumn": "column_name",
    "yAxisColumns": ["column1", "column2"],
    "xAxisLabel": "...",
    "yAxisLabel": "...",
    "colors": ["#..."],
    "stacked": false
  },
  "reasoning": "Why this chart type was chosen",
  "rateLimit": { "remaining": 9, "limit": 10 }
}

// Error
{ "error": "Failed to generate chart configuration" }
```

> **Note:** Uses OpenAI **Chat Completions** with function/tool calling (`CHART_TOOLS`),
> not the Responses API. Each chart type maps to a distinct tool
> (`create_bar_chart`, `create_line_chart`, `create_pie_chart`, `create_area_chart`,
> `create_scatter_plot`, `create_composed_chart`); field names differ per type
> (e.g. pie uses `nameColumn`/`valueColumn`, scatter uses `xAxisColumn`/`yAxisColumn`,
> composed uses `bars`/`lines`/`areas`).

### Chart Type Selection

The AI selects chart type based on data characteristics:

| Data Pattern | Chart Type |
|-------------|------------|
| Time series | Line chart |
| Categories with values | Bar chart |
| Parts of whole | Pie chart |
| Trends over time | Area chart |
| Two numeric dimensions | Scatter plot |
| Mixed series (e.g. totals + trend) | Composed chart (bars + lines + areas) |

### Example Usage

```typescript
// After executing a query
const chartResponse = await fetch('/api/chart/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    columns: result.columns,
    rows: result.rows,
    rowCount: result.rows.length,
    preferredChartType: "bar" // optional
  })
});

const { config, reasoning } = await chartResponse.json();
// Use `config` to render the ChartDisplay component
```

---

## Suggestions Flow Diagram

```
Dashboard Page Loads
        │
        ▼
Check localStorage cache
        │
        ├─► CACHED: Display suggestions
        │
        └─► NOT CACHED:
                │
                ▼
┌──────────────────────────────┐
│ POST /dashboard/suggestions   │
│ - Query OpenAI with schema   │
│ - Parse suggestions          │
└───────────┬──────────────────┘
                │
        ┌───────┴───────┐
        │               │
    SUCCESS          VECTOR_STORE_404
        │               │
        ▼               ▼
Cache & Display    Show reupload prompt
```

## Chart Generation Flow

```
Query Executed
        │
        ▼
User clicks "Visualize"
        │
        ▼
┌─────────────────────────┐
│ POST /chart/generate     │
│ - Analyze data structure │
│ - Select chart type      │
│ - Configure axes/series  │
└───────────┬─────────────┘
        │
        ▼
Render ChartDisplay component
```

---

## Error Handling

### Vector Store Not Found

When OpenAI can't find the vector store (deleted, expired):

```typescript
// API returns
{
  "error": "VECTOR_STORE_NOT_FOUND",
  "needsReupload": true
}

// Client should:
// 1. Show message to user
// 2. Redirect to schema upload
// 3. Re-upload schema to create new vector store
```

### Missing API Key

```typescript
// API returns
{ "error": "OpenAI API key is not configured" }

// Client should:
// 1. Show message about configuration
// 2. Suggest checking environment variables
```

---

## Related Documentation
- [API Overview](./overview.md) - All endpoints
- [OpenAI Integration](../guides/openai-integration.md) - Vector store details
- [Components Overview](../components/overview.md) - Dashboard components
