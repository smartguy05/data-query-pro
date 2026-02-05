# Feature Components

Reusable feature components that provide business functionality.

## Schema Components

### SchemaExplorer
**File:** `components/schema-explorer.tsx`

Interactive schema browser with editing capabilities.

**Props:**
```typescript
interface SchemaExplorerProps {
  schema: Schema;
  onSchemaUpdate: (schema: Schema) => void;
  readOnly?: boolean;
}
```

**Features:**
- Collapsible table list
- Column details (type, nullable, keys)
- Inline description editing
- AI description generation
- Hide/show tables and columns
- Visual indicators for new/modified items

**Usage:**
```tsx
<SchemaExplorer
  schema={currentSchema}
  onSchemaUpdate={(updatedSchema) => setSchema(updatedSchema)}
/>
```

**Key Methods:**
```typescript
// Toggle table expansion
const toggleTable = (tableName: string) => {
  setExpandedTables(prev =>
    prev.includes(tableName)
      ? prev.filter(t => t !== tableName)
      : [...prev, tableName]
  );
};

// Update description
const updateDescription = (tableName: string, columnName?: string, description: string) => {
  const updatedSchema = { ...schema };
  // Update logic...
  onSchemaUpdate(updatedSchema);
};

// Toggle visibility
const toggleHidden = (tableName: string, columnName?: string) => {
  const updatedSchema = { ...schema };
  // Toggle logic...
  onSchemaUpdate(updatedSchema);
};
```

---

## Query Components

### QueryResultsDisplay
**File:** `components/query-results-display.tsx`

Displays query execution results.

**Props:**
```typescript
interface QueryResultsDisplayProps {
  columns: string[];
  rows: string[][];
  rowCount: number;
  executionTime: number;
  sql?: string;
  onVisualize?: () => void;
}
```

**Features:**
- Sortable columns
- Filterable data
- Pagination
- Row search
- CSV export
- Switch to chart view
- Automatic column type detection (text, number, currency, date, URL)
- Manual column type override via dropdown on column header badges

**Column Type Detection:**

The component auto-detects column types by sampling the first 10 rows:

| Type | Detection Method | Formatting |
|------|-----------------|------------|
| `text` | Default fallback | Plain string |
| `number` | All values numeric | Locale-formatted (e.g., `1,234`) |
| `currency` | Column name matches currency keywords (e.g., `price`, `revenue`, `cost`) AND values are numeric | USD formatted (e.g., `$1,234.56`) |
| `date` | All values match ISO date format | Localized date/time |
| `url` | All values match URL pattern (`http://`, `https://`, `www.`) | Clickable link with external link icon |
| `empty` | All values null/undefined/empty | No formatting |

Users can override the auto-detected type by clicking the type badge on any column header, which opens a dropdown with all available types. The auto-detected type is marked with "(detected)" in the dropdown. Overrides reset when new query results are loaded.

**View Modes:**
1. **Table** - Standard data table with sorting and type-aware formatting
2. **Chart** - Visualization (via ChartDisplay)

**Export Function:**
```typescript
const exportToCSV = () => {
  const csvContent = [
    columns.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  // Trigger download
};
```

---

## Chart Components

### ChartDisplay
**File:** `components/chart-display.tsx`

Main chart renderer supporting multiple chart types.

**Props:**
```typescript
interface ChartDisplayProps {
  config: ChartConfig;
  data: ChartData[];
}

interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  title: string;
  xAxis: string;
  yAxis: string;
  series: string[];
  options?: {
    stacked?: boolean;
    showLegend?: boolean;
  };
}
```

**Usage:**
```tsx
<ChartDisplay
  config={{
    type: 'bar',
    title: 'Monthly Sales',
    xAxis: 'month',
    yAxis: 'revenue',
    series: ['revenue', 'profit']
  }}
  data={chartData}
/>
```

### Individual Chart Components

Located in `components/charts/`:

- **bar-chart.tsx** - Vertical/horizontal bar charts
- **line-chart.tsx** - Line charts with optional area fill
- **pie-chart.tsx** - Pie/donut charts
- **area-chart.tsx** - Stacked area charts
- **scatter-chart.tsx** - Scatter plots

All use Recharts library and follow consistent prop patterns.

---

## Report Components

### SaveReportDialog
**File:** `components/save-report-dialog.tsx`

Dialog for saving queries as reports.

**Props:**
```typescript
interface SaveReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  sql: string;
  explanation: string;
  confidence: number;
  warnings: string[];
  connectionId: string;
  onSave: (report: SavedReport) => void;
}
```

**Fields Captured:**
- Report name
- Description
- Parameters (optional)

### EditReportDialog
**File:** `components/edit-report-dialog.tsx`

Dialog for editing existing report metadata.

**Props:**
```typescript
interface EditReportDialogProps {
  report: SavedReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (report: SavedReport) => void;
}
```

### ParameterConfig
**File:** `components/parameter-config.tsx`

Configure parameters for parameterized reports.

**Props:**
```typescript
interface ParameterConfigProps {
  parameters: ReportParameter[];
  onChange: (parameters: ReportParameter[]) => void;
}
```

**Parameter Types:**
- `text` - Text input
- `number` - Numeric input
- `date` - Date picker
- `datetime` - DateTime picker
- `boolean` - Checkbox

### ParameterInputDialog
**File:** `components/parameter-input-dialog.tsx`

Dialog for entering parameter values when running reports.

**Props:**
```typescript
interface ParameterInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameters: ReportParameter[];
  onSubmit: (values: Record<string, any>) => void;
}
```

### SavedReports
**File:** `components/saved-reports.tsx`

List component for displaying saved reports.

**Props:**
```typescript
interface SavedReportsProps {
  reports: SavedReport[];
  onRun: (report: SavedReport) => void;
  onEdit: (report: SavedReport) => void;
  onDelete: (reportId: string) => void;
  connectionFilter?: string;
}
```

---

## Dashboard Components

### ExecutiveMetrics
**File:** `components/executive-metrics.tsx`

Static metric cards showing Revenue Growth, Customer Satisfaction, Market Share, and Operational Efficiency with value vs target and status badges.

### QuickActions
**File:** `components/quick-actions.tsx`

Quick action card with 4 color-coded buttons:
- New Query (blue)
- Generate Report (green)
- Connect Database (purple)
- View Analytics (orange)

### RecentReports
**File:** `components/recent-reports.tsx`

Shows mock recent reports with type badges, timestamps, and download options.

### PerformanceChart
**File:** `components/performance-chart.tsx`

Mock 6-month revenue/customers/orders trend visualization with manual bar chart rendering.

---

## Query Components

### QueryTabContent
**File:** `components/query-tab-content.tsx`

Displays an individual query tab with generated SQL, explanation, warnings, and results.

**Features:**
- Editable SQL textarea (dark background, monospace)
- Execute and Save as Report buttons
- Revision button for failed queries
- Follow-up question button
- Shows execution results or errors
- Displays explanation responses (alternative to SQL queries)
- Smooth scroll to results

### FollowupDialog
**File:** `components/followup-dialog.tsx`

Dialog for asking follow-up questions about query results.

**Features:**
- Text input for follow-up question
- Row limit selector: None (schema only), 25, 50, 100, or All
- Warning when "All" exceeds 500 rows
- Ctrl+Enter keyboard shortcut
- Disabled state during processing

---

## Infrastructure Components

### ErrorBoundary
**File:** `components/error-boundary.tsx`

React class component that catches JavaScript errors in child components.

**Features:**
- Fallback UI with error message
- Reset button to recover
- Optional custom fallback component
- `withErrorBoundary` HOC for wrapping components

**Usage:**
```tsx
<ErrorBoundary>
  <ComponentThatMightError />
</ErrorBoundary>

// Or with HOC
const SafeComponent = withErrorBoundary(MyComponent);
```

### OpenAIApiProvider
**File:** `components/openai-api-provider.tsx`

Context provider for OpenAI API key management.

**Features:**
- Stores key in sessionStorage (not localStorage)
- Syncs between tabs via storage events
- Provides: `setApiKey`, `clearApiKey`, `getAuthHeaders`
- Exports `useOpenAIApiContext` hook

### ApiKeyDialog
**File:** `components/api-key-dialog.tsx`

Dialog for users to enter their OpenAI API key to bypass rate limits.

**Features:**
- Key validation (must start with "sk-")
- Reset time information display
- Rate limit bypass explanation

### ApiKeyIndicator
**File:** `components/api-key-indicator.tsx`

Navigation indicator showing OpenAI API key status.

**Features:**
- Green checkmark if key configured
- Yellow alert if using demo (rate limited)
- Popover menu for key management
- Only renders when rate limiting is enabled

---

## Navigation

### Navigation
**File:** `components/navigation.tsx`

Top navigation bar.

**Features:**
- Route links with active state (blue highlight)
- Theme toggle (dark/light)
- API key status indicator (when rate limiting enabled)
- Mobile responsive with collapsible menu
- Skips rendering on /landing page

**Usage:**
```tsx
// In layout or page
<Navigation />
```

---

## Theme Components

### ThemeProvider
**File:** `components/theme-provider.tsx`

Wrapper for next-themes.

**Usage:**
```tsx
<ThemeProvider attribute="class" defaultTheme="system">
  {children}
</ThemeProvider>
```

### ThemeToggle
**File:** `components/theme-toggle.tsx`

Toggle button for dark/light mode.

---

## Common Patterns

### Loading States
```tsx
{isLoading ? (
  <div className="flex items-center justify-center p-4">
    <Loader2 className="h-6 w-6 animate-spin" />
  </div>
) : (
  <Content />
)}
```

### Empty States
```tsx
{items.length === 0 ? (
  <EmptyState
    icon={<DatabaseIcon />}
    title="No items found"
    description="Create your first item to get started"
    action={<Button onClick={onCreate}>Create Item</Button>}
  />
) : (
  <ItemList items={items} />
)}
```

### Error Handling
```tsx
{error && (
  <Alert variant="destructive">
    <AlertDescription>{error.message}</AlertDescription>
  </Alert>
)}
```

---

## Related Documentation
- [Components Overview](./overview.md) - Component categories
- [Page Components](./pages.md) - App pages
- [Models Overview](../models/overview.md) - TypeScript interfaces
