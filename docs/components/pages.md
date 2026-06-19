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
- Test connection (real - connects and runs test query)
- Upload schema to OpenAI

### Connection Form Fields
```typescript
{
  name: string;          // Display name
  type: string;          // Database type (postgresql, mysql, sqlserver, sqlite)
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
- "Connect" button performs a real connection test via `/api/connection/test`
- Passwords stored in plain text in localStorage
- All four database types (PostgreSQL, MySQL, SQL Server, SQLite) are fully implemented with adapters

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
- **Copy descriptions from another connection** (`components/copy-descriptions-dialog.tsx` + `utils/copy-descriptions.ts`): name-matches tables/columns against a source connection's schema and copies `description` (and optionally `aiDescription` + `hidden` flags), in fill-empty or overwrite mode. Client-side; applied via `setSchema`, then pushed to OpenAI via the existing "Save to OpenAI" button. Ideal for the same DB across dev/staging/prod.

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
- View results in table or chart with smart column type detection
- Manual column type override (text, number, currency, date, URL)
- Save as report
- Auto-execute queries from saved reports via URL parameters

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
// Tab-based state management for multiple queries
const [tabs, setTabs] = useState<QueryTab[]>([]);
const [activeTabId, setActiveTabId] = useState<string>('');
const [naturalQuery, setNaturalQuery] = useState('');
const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
const [showSaveDialog, setShowSaveDialog] = useState(false);
const [rowLimit, setRowLimit] = useState<RowLimitOption>(50);
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

## History Page

**Route:** `/history`
**File:** `app/history/page.tsx`

Device-local history of every executed query.

### Features
- Lists all executed queries (ad-hoc, report-run, follow-up), newest first, with success/failure status, row count, execution time, source badge, and relative timestamp
- Search by SQL, natural-language question, or connection name
- "This connection only" toggle (filters to the active connection)
- Per-entry actions: **Re-run** (sets the entry's connection active, then `/query?sql=...&autoExecute=true`), **Save as report** (reuses `SaveReportDialog`), **Copy SQL**, **Delete**
- **Clear History** with confirmation dialog

### History Storage
- Stored in localStorage under `query_history` (device-local in **both** auth and no-auth modes — never synced to the app DB)
- Capped ring buffer (`HISTORY.MAX_ENTRIES` in `lib/constants.ts`), newest first
- Captured at the single execution choke point (`executeTabQuery` in `app/query/page.tsx`) via context `recordQueryHistory` (fire-and-forget — never breaks query execution)

---

## Learning Page

**Route:** `/learning`
**File:** `app/learning/page.tsx`

Curation UI for the **learned query corrections** that improve future SQL generation
(failed→fixed query pairs the AI learns from). Reached via the **Query ▾** nav dropdown.

### Features
- Lists learned corrections for the **current connection's schema fingerprint**
  (`computeSchemaFingerprint(currentSchema)` from `utils/schema-fingerprint.ts`)
- Connection selector (shown when more than one connection exists)
- Search by question, SQL (failed/corrected), or error message
- Edit a correction (question / error / corrected SQL) and delete a correction
- Each card shows the failed query + error, the corrected query, database type, and
  (in auth mode) the contributing author and relative timestamp

### Behaviour
- Corrections are loaded via context `getCorrectionsForFingerprint(fingerprint)` and
  mutated via `updateQueryCorrection` / `deleteQueryCorrection`.
- **Permissions** (`canManage`): with auth disabled everything is device-local and freely
  editable; in auth mode a correction is editable/deletable only by its author (`ownerId === user.id`)
  or an admin (`isAdmin`). The server enforces the same rule.
- In auth mode corrections are pooled team-wide by schema fingerprint; with auth disabled they
  are device-local. Empty/no-schema states prompt the user to select a connection and load its schema.

---

## Profile Page

**Route:** `/profile`
**File:** `app/profile/page.tsx`

Account overview and usage summary. Reached from the **Profile** item in the user menu
(profile dropdown) when auth is enabled.

### Sections
1. **Account card** - avatar/name/email, an **Admin** badge and OIDC `groups` (from `useAuth()`).
   When auth is disabled it shows a **"Local mode"** fallback instead.
2. **Usage stats** - Query Accuracy %, Connections count, and Saved Reports count
   (from `useDatabaseOptions()`: `queryAccuracy`, `connections`, `reports`).
3. **Actions** (auth mode, signed in) - **Admin Panel** link (admins only) and **Sign out**.

### Behaviour
- In auth mode, redirects to `/` if the user is not authenticated.

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

## Admin Page

**Route:** `/admin`
**File:** `app/admin/page.tsx`

Admin-only panel for managing **server connections** and their assignments.
Available in auth mode; `useAuth()` gates access by `isAdmin`.

### Features
- Create / edit / delete server connections (stored in the app DB, credentials encrypted)
- Assign connections to individual users or to OIDC groups
- Search users by email/name when assigning
- View existing assignments per connection

### Data Flow
- Connections: `/api/admin/server-connections` (+ `/[id]`)
- Assignments: `/api/admin/server-connections/[id]/assign` and `/assignments`
- User search: `/api/sharing/users/search`

See [Auth-mode endpoints](../api/data-endpoints.md#admin-endpoints-apiadmin) and
[Auth & Data Layer](../architecture/auth-and-data-layer.md).

---

## Landing Page

**Route:** `/landing`
**File:** `app/landing/page.tsx`

Public marketing/showcase page (features, screenshots, links). Has its own layout
(`app/landing/layout.tsx`) with SEO metadata and renders without the app `Navigation`.
It is an "ungated" route — the [ContentLoadingGate](./infrastructure.md#contentloadinggate)
does not wait for database context here.

---

## Auth Login Page

**Route:** `/auth/login`
**File:** `app/auth/login/page.tsx`

Sign-in page shown in auth mode.

- On mount, checks `/api/config/auth-status`; if auth is disabled, redirects to `/`.
- Sign-in button dynamically imports `next-auth/react` and calls
  `signIn("authentik", { callbackUrl: "/" })`.

> `app/setup/` and `app/users/` directories exist but currently contain no pages.

---

## Layout Component

**File:** `app/layout.tsx`

Root layout wrapping all pages. Provider nesting (outermost → innermost):

```tsx
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
  <AuthProvider>
    <OpenAIApiProvider>
      <DatabaseConnectionOptions>
        <Navigation />
        <main>
          <ErrorBoundary>
            <ContentLoadingGate>{children}</ContentLoadingGate>
          </ErrorBoundary>
        </main>
        <DataMigrationDialog />
        <Toaster />
      </DatabaseConnectionOptions>
    </OpenAIApiProvider>
  </AuthProvider>
</ThemeProvider>
```

### Provider Order
1. **ThemeProvider** - Dark/light mode (`defaultTheme="dark"`, system disabled, no transition)
2. **AuthProvider** - Conditional next-auth `SessionProvider` (auth mode only)
3. **OpenAIApiProvider** - User API key (BYOK) management
4. **DatabaseConnectionOptions** - Application state
5. **Navigation** - Top navigation bar (hidden on `/landing` and `/auth/login`)
6. **ErrorBoundary** → **ContentLoadingGate** - Error catching + init gate around page content
7. **DataMigrationDialog** + **Toaster** - First-login import prompt and toast notifications

See [Infrastructure Components](./infrastructure.md) for each provider.

---

## Related Documentation
- [Components Overview](./overview.md) - All components
- [Feature Components](./features.md) - Reusable features
- [State Management](../architecture/state-management.md) - Context details
