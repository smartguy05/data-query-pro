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

**View Modes:**
1. **Table** - Standard data table with sorting
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

High-level metric cards for dashboard.

### QuickActions
**File:** `components/quick-actions.tsx`

Quick action buttons:
- New Query
- View Schema
- Run Recent Report
- Export Data

### RecentReports
**File:** `components/recent-reports.tsx`

Shows recently run reports with quick-run option.

### ReportTemplates
**File:** `components/report-templates.tsx`

Gallery of report templates by category.

### ScheduledReports
**File:** `components/scheduled-reports.tsx`

List of scheduled report runs (placeholder for future feature).

---

## Navigation

### Navigation
**File:** `components/navigation.tsx`

Top navigation bar.

**Features:**
- Route links with active state
- Current connection indicator
- Theme toggle
- Mobile responsive menu

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
