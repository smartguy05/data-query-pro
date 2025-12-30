# Page Components

Next.js App Router page components for each route.

## Dashboard Page

**Route:** `/`
**File:** `app/page.tsx`

Main dashboard showing setup progress, AI suggestions, and saved reports.

### Sections

1. **Setup Progress** - Checklist for connection, schema, upload
2. **AI Suggestions** - Metric suggestions from OpenAI
3. **Recent Reports** - Recently used reports
4. **Quick Actions** - Common task buttons

### Key Dependencies
- `useDatabaseOptions()` - For connection/schema state
- `/api/dashboard/suggestions` - AI suggestions
- localStorage - Suggestions cache

### Data Flow
```
Page loads
    │
    ├─► Check currentConnection
    │       └─► No connection: Show setup prompt
    │
    ├─► Check suggestions cache
    │       ├─► Cached: Display suggestions
    │       └─► Not cached: Fetch from API
    │
    └─► Load recent reports from localStorage
```

---

## Database Page

**Route:** `/database`
**File:** `app/database/page.tsx`

Database connection management (CRUD operations).

### Features
- List all saved connections
- Add new connection form
- Edit existing connections
- Delete connections
- Test connection (simulated)
- Upload schema to OpenAI

### Connection Form Fields
```typescript
{
  name: string;          // Display name
  type: string;          // Database type (PostgreSQL only working)
  host: string;          // Hostname
  port: string;          // Port number
  database: string;      // Database name
  username: string;      // Username
  password: string;      // Password
  description?: string;  // Business context
}
```

### Key Operations

**Add Connection:**
```typescript
const handleAddConnection = async (formData: ConnectionFormData) => {
  const connection: DatabaseConnection = {
    id: crypto.randomUUID(),
    ...formData,
    status: "disconnected",
    createdAt: new Date().toISOString()
  };
  addConnection(connection);
};
```

**Upload Schema:**
```typescript
const handleUploadSchema = async (connectionId: string) => {
  const response = await fetch('/api/schema/upload-schema', {
    method: 'POST',
    body: JSON.stringify({
      data: currentSchema,
      existingFileId: connection.schemaFileId,
      existingVectorStoreId: connection.vectorStoreId
    })
  });
  const { fileId, vectorStoreId } = await response.json();
  updateConnection({ ...connection, schemaFileId: fileId, vectorStoreId });
};
```

### Important Notes
- "Connect" button simulates 2-second delay (doesn't test real connection)
- Passwords stored in plain text in localStorage
- Only PostgreSQL is actually implemented despite UI showing multiple types

---

## Schema Page

**Route:** `/schema`
**File:** `app/schema/page.tsx`

Schema exploration and AI description generation.

### Features
- View database tables and columns
- Introspect schema from database
- Generate AI descriptions
- Edit descriptions manually
- Hide/show tables and columns
- Schema change detection

### Key Operations

**Introspect Schema:**
```typescript
const handleIntrospect = async () => {
  const response = await fetch('/api/schema/introspect', {
    method: 'POST',
    body: JSON.stringify({ connection: currentConnection })
  });
  const { schema } = await response.json();
  setSchema({ connectionId: currentConnection.id, tables: schema.tables });
};
```

**Generate Descriptions:**
```typescript
const handleGenerateDescriptions = async () => {
  const response = await fetch('/api/schema/generate-descriptions', {
    method: 'POST',
    body: JSON.stringify({
      schema: currentSchema,
      databaseDescription: currentConnection.description
    })
  });
  const { schema: enhancedSchema } = await response.json();
  setSchema(enhancedSchema);
};
```

### Schema Change Detection
When re-introspecting, the system:
1. Compares new schema with cached version
2. Marks new tables with `isNew: true`
3. Marks new columns with `isNew: true`
4. Marks modified columns with `isModified: true`

---

## Query Page

**Route:** `/query`
**File:** `app/query/page.tsx`

Natural language query interface.

### Features
- Natural language input
- Generated SQL display
- Confidence score
- Execute queries
- View results in table or chart
- Save as report

### Query Flow

```
1. User enters natural language query
        │
        ▼
2. POST /api/query/generate
        │
        ▼
3. Display generated SQL, explanation, confidence
        │
        ▼
4. User clicks "Execute"
        │
        ▼
5. POST /api/query/execute
        │
        ▼
6. Display results (table or chart)
        │
        ▼
7. Optional: Save as report
```

### State Management
```typescript
const [query, setQuery] = useState('');
const [generatedSQL, setGeneratedSQL] = useState('');
const [explanation, setExplanation] = useState('');
const [confidence, setConfidence] = useState(0);
const [results, setResults] = useState<QueryResults | null>(null);
const [isGenerating, setIsGenerating] = useState(false);
const [isExecuting, setIsExecuting] = useState(false);
```

### Key Operations

**Generate Query:**
```typescript
const handleGenerate = async () => {
  setIsGenerating(true);
  const response = await fetch('/api/query/generate', {
    method: 'POST',
    body: JSON.stringify({
      query,
      databaseType: currentConnection.type,
      vectorStoreId: currentConnection.vectorStoreId,
      schemaData: currentSchema
    })
  });
  const { sql, explanation, confidence, warnings } = await response.json();
  setGeneratedSQL(sql);
  setExplanation(explanation);
  setConfidence(confidence);
  setIsGenerating(false);
};
```

---

## Reports Page

**Route:** `/reports`
**File:** `app/reports/page.tsx`

Saved reports management.

### Features
- List all saved reports
- Filter by connection
- Search reports
- Run parameterized reports
- Edit report metadata
- Delete reports
- Export/import reports

### Report Storage
Reports stored in localStorage under `saved_reports` key.

### Key Operations

**Run Report:**
```typescript
const handleRunReport = async (report: SavedReport, params?: Record<string, any>) => {
  let sql = report.sql;

  // Replace parameters
  if (report.parameters && params) {
    for (const param of report.parameters) {
      sql = sql.replace(`{{${param.name}}}`, params[param.name]);
    }
  }

  // Execute
  const response = await fetch('/api/query/execute', {
    method: 'POST',
    body: JSON.stringify({
      sql,
      connection: getConnection(report.connectionId)
    })
  });
};
```

**Export Reports:**
```typescript
const handleExport = () => {
  const reports = JSON.parse(localStorage.getItem('saved_reports') || '[]');
  const blob = new Blob([JSON.stringify(reports, null, 2)], {
    type: 'application/json'
  });
  // Download blob
};
```

---

## Layout Component

**File:** `app/layout.tsx`

Root layout wrapping all pages.

```tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system">
          <DatabaseConnectionOptions>
            {children}
          </DatabaseConnectionOptions>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### Provider Order
1. **ThemeProvider** - Dark/light mode
2. **DatabaseConnectionOptions** - Application state
3. **Toaster** - Toast notifications (outside providers)

---

## Related Documentation
- [Components Overview](./overview.md) - All components
- [Feature Components](./features.md) - Reusable features
- [State Management](../architecture/state-management.md) - Context details
