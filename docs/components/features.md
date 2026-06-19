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

### SchemaUpdateModal
**File:** `components/schema-update-modal.tsx`

Modal that summarizes detected schema changes (new tables, new/modified columns)
after re-introspection and asks the user to confirm applying the update.

**Props:**
```typescript
interface SchemaUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: Schema | null;        // schema with isNew/isModified flags
  onConfirm: () => void;
  onCancel: () => void;
}
```

Counts are derived from `isNew` / `isModified` flags on tables and columns
(see [Schema change detection](./pages.md#schema-page)).

---

## Query Components

### QueryResultsDisplay
**File:** `components/query-results-display.tsx`

Displays query execution results.

**Props:**
```typescript
interface QueryResultsProps {
  data: {
    columns: string[];
    rows: DataRows;
    rowCount: number;
    executionTime: number;
  };
  /** Seed a saved chart (e.g. a report's persisted visualization) so it renders immediately, no AI call. */
  initialChartConfig?: ChartConfig;
  /** Notified whenever the currently displayed chart config changes (or null when viewing the table). */
  onChartConfigChange?: (config: ChartConfig | null) => void;
  /** When provided (results belong to a saved report), renders a "Save chart to report" action. */
  onSaveChart?: (config: ChartConfig) => void;
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

Main chart renderer. Switches over `config.type` to render the matching chart
component, transforming the `columns`/`rows` result shape into Recharts row objects.

**Props:**
```typescript
interface ChartDisplayProps {
  config: ChartConfig;   // discriminated union, see models/chart-config.interface.ts
  columns: string[];
  rows: DataRows;
}
```

`config.type` is one of `"bar" | "line" | "pie" | "area" | "scatter" | "composed"`;
an unknown type renders an "Unknown chart type" alert.

**Usage:**
```tsx
<ChartDisplay
  config={{
    type: 'bar',
    title: 'Monthly Sales',
    xAxisColumn: 'month',
    yAxisColumns: ['revenue', 'profit'],
  }}
  columns={columns}
  rows={rows}
/>
```

### Individual Chart Components

Located in `components/charts/`:

- **bar-chart.tsx** - Vertical/horizontal bar charts
- **line-chart.tsx** - Line charts with optional area fill
- **pie-chart.tsx** - Pie/donut charts
- **area-chart.tsx** - Stacked area charts
- **scatter-chart.tsx** - Scatter plots
- **composed-chart.tsx** - Mixed bars/lines/areas on shared axes (see below)

All use Recharts library and follow consistent prop patterns.

### Composed Chart
**File:** `components/charts/composed-chart.tsx`

Renders multiple numeric series of **different kinds** (bars, lines, and/or areas)
on a single shared X/Y axis pair, driven by `ComposedChartConfig`
(`models/chart-config.interface.ts`):

```typescript
interface ComposedChartConfig extends BaseChartConfig {
  type: "composed";
  xAxisColumn: string;     // shared X axis for all series
  bars?: string[];         // columns rendered as bars
  lines?: string[];        // columns rendered as lines
  areas?: string[];        // columns rendered as filled areas
  xAxisLabel?: string;
  yAxisLabel?: string;
  colors?: string[];
}
```

**Behavior:**
- **Render order is bars → areas → lines**, so lines draw on top of the filled
  areas and bars.
- Colors come from a single **running color index** across all three series
  groups (bars, then areas, then lines), cycling through `config.colors` (default
  palette `#3b82f6, #10b981, #f59e0b, #ef4444, #8b5cf6, #ec4899`).
- All series columns are **numerically coerced** (same guard as the other
  renderers — non-numeric / empty values are left untouched).
- The legend shows only when there is more than one numeric series.

**When to use:** comparing series that read better with different visual emphasis
on the same axis — e.g. totals/counts as bars alongside a trend, average, or rate
as a line. The AI can select it via the `create_composed_chart` tool
(`CHART_TOOLS`), mapped to `"composed"` by `chartTypeMap` in
`app/api/chart/generate/route.ts`.

### ChartCustomizer
**File:** `components/chart-customizer.tsx`

A live-editing panel for chart configuration. Lets users change the chart type,
remap columns, set axis labels and display toggles, and pick colors — previewing
changes immediately. Exports `ChartCustomizer`, the `reshapeChartConfig` helper,
and the `CHART_PALETTE` constant.

**Props:**
```typescript
interface ChartCustomizerProps {
  config: ChartConfig;
  columns: string[];
  onChange: (config: ChartConfig) => void;
}
```

**Per-type column mapping** — the rendered fields depend on `config.type`:
- `bar` / `line` / `area`: single **X-Axis** select + multi-select **Y-Axis
  columns** (series) checklist.
- `pie`: **Category (name)** and **Value** column selects.
- `scatter`: **X**, **Y**, and optional **Point label** column selects.
- `composed`: **X-Axis** select plus three checklists — **Bars**, **Lines**,
  **Areas** — so any column can be assigned to a series kind.

Axis-label inputs show for everything except pie; display toggles are type-specific
(Stacked for bar/area, Smooth + Show dots for line, Show labels for pie). Colors use
a palette of swatches plus a native `<input type="color">` picker; for scatter it is
a single point color, otherwise one color per series (in the renderer's color order).

**`reshapeChartConfig(prev, newType, columns)`** rebuilds a config of `newType`
while **carrying column choices across chart shapes** — it preserves
title/description/colors and maps the previous X column and series columns into the
new shape's fields (filling sensible defaults from `columns` when needed). This is
what runs when the user switches the chart type in the dropdown, so selections
survive the switch.

**Build-manually flow:** the chart view dropdown in
[`QueryResultsDisplay`](#queryresultsdisplay) offers **"Build manually (no AI)"**,
which calls `reshapeChartConfig(undefined, "bar", columns)` to seed a default bar
chart and opens the customizer — no AI call. A **"Customize"** toggle reveals the
panel for any displayed chart (AI-generated or manual).

**Persistence:** the customized config is lifted out of `QueryResultsDisplay` via
`onChartConfigChange` into the query tab's `chartConfig`
(`models/query-tab.interface.ts`). When the results belong to a saved report, a
**"Save chart to report"** action (`onSaveChart`) writes the config to the report's
`SavedReport.visualization` (`app/query/page.tsx`, `saveChartToReport`). On reopening
the report, the tab's chart is **seeded from `report.visualization`** so it renders
without an AI call.

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

The dashboard surfaces **Dashboard Widgets** — pinned saved reports whose SQL is
executed live on dashboard load and rendered as KPI cards or a trend chart. See
the [Dashboard Widgets](#dashboard-widgets) section below for the full flow.

### Dashboard Widgets

Users pin a saved report to the dashboard from the report's actions dropdown in
[`SavedReports`](#savedreports) — "Pin as Dashboard Metric" or "Pin as Dashboard
Chart" (and the corresponding "Unpin …"). Pinning sets a `dashboardWidget` config
on the `SavedReport` (`components/saved-reports.tsx`, `setDashboardWidget`) and
persists it via the storage layer; unpinning deletes the config.

**`DashboardWidgetConfig`** (`models/saved-report.interface.ts`):

```typescript
interface DashboardWidgetConfig {
  kind: 'metric' | 'chart';

  // metric only — the KPI's value is rows[0][0] of the report's result
  target?: number;
  unit?: 'number' | 'currency' | 'percent';
  higherIsBetter?: boolean;   // default true

  // chart only — optional cached config; generated on the fly when absent
  chartConfig?: ChartConfig;
}
```

The companion `SavedReport.visualization?: ChartConfig` field stores the report's
saved chart; when present, the dashboard chart widget uses it directly (no AI call).

**Load flow (`loadDashboardWidgets` in `app/page.tsx`):**

1. Filters the active connection's reports to those with a `dashboardWidget`.
2. Caps the dashboard at **4 metric reports** (`.slice(0, 4)`) plus **1 chart
   report** (`.find(...)`).
3. Runs each report's SQL via `POST /api/query/execute` (params substituted by
   `utils/substitute-params.ts`; queries with an unresolved `{{placeholder}}` are
   skipped so the dashboard never blocks on required parameters).
4. Metric queries run together under `Promise.allSettled`, so a single failing
   query is isolated and never breaks the rest of the dashboard strip. The whole
   load is fire-and-forget.
5. For the chart widget, config resolution prefers `report.visualization`, then
   `dashboardWidget.chartConfig`, and only calls `POST /api/chart/generate` when
   neither exists.

**Metric status logic (`utils/metric-status.ts`):**

- `formatMetricValue(value, unit?)` coerces to a number (stripping non-numeric
  characters) and formats by unit — `currency` → USD, `percent` → `N%`, default →
  locale number. Non-numeric values fall back to their string form (or an em dash).
- `computeStatus(value, target?, higherIsBetter = true)` returns
  `"exceeding" | "on-track" | "behind" | "neutral"`. When `higherIsBetter` the
  ratio is `value/target`; otherwise it inverts to `target/value` so a lower value
  scores better. Ratio `>= 1` → exceeding, `>= 0.9` → on-track, below → behind.
  Returns `neutral` when there is no target or the value isn't numeric. Edge cases:
  `higherIsBetter` with target `0` → neutral; `!higherIsBetter` with value `0` →
  exceeding.

#### ExecutiveMetrics
**File:** `components/executive-metrics.tsx`

Renders the pinned-report KPI strip. Each `KpiMetric` shows the report name,
optional description, formatted value, an optional "Target: …" badge, and a
status icon/color keyed off `KpiStatus` (`exceeding` / `on-track` / `behind` /
`neutral`). Returns `null` when there are no metrics. When `onRemove` is provided,
each card gets an unpin (X) button.

```typescript
function ExecutiveMetrics({
  metrics: KpiMetric[];
  onRemove?: (reportId: string) => void;
}): JSX.Element | null
```

#### PerformanceChart
**File:** `components/performance-chart.tsx`

Thin wrapper around [`ChartDisplay`](#chartdisplay) for the pinned-report trend
chart. `title`/`description` override the chart config's own header so the widget
reflects the report's name; when `onRemove` is supplied, an unpin button is
overlaid in the card's top-right corner.

```typescript
interface PerformanceChartProps {
  config: ChartConfig;
  columns: string[];
  rows: DataRows;
  title?: string;
  description?: string;
  onRemove?: () => void;
}
```

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

### ScheduledReports
**File:** `components/scheduled-reports.tsx`

Demo UI listing scheduled report deliveries (frequency, next run, recipients, format)
with active/pause toggles. Uses a hardcoded `scheduledReports` array — no scheduling
backend exists yet.

### ReportTemplates
**File:** `components/report-templates.tsx`

Demo gallery of report template cards (Executive Summary, Sales Performance, etc.)
with category and query-count badges. Uses a hardcoded `templates` array.

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

> **Infrastructure, navigation, theme, auth, sharing, and modal components** are
> documented separately in [Infrastructure Components](./infrastructure.md).

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
- [Infrastructure Components](./infrastructure.md) - Providers, navigation, theme, auth, modals
- [Page Components](./pages.md) - App pages
- [Models Overview](../models/overview.md) - TypeScript interfaces
