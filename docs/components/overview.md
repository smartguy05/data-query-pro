# Components Overview

DataQuery Pro uses React components organized by functionality. UI primitives come from shadcn/ui.

## Component Categories

| Category | Location | Purpose |
|----------|----------|---------|
| Pages | `app/*.tsx` | Route-level page components |
| Features | `components/*.tsx` | Business logic components |
| UI | `components/ui/*.tsx` | shadcn/ui primitives (do not edit) |
| Charts | `components/charts/*.tsx` | Chart implementations |

## Component Hierarchy

```
layout.tsx
├── ThemeProvider
│   └── AuthProvider (SessionProvider, conditional)
│       └── OpenAIApiProvider (API key context)
│           └── DatabaseConnectionOptions (state context)
│               ├── Navigation (with user menu when auth enabled)
│               │   └── ApiKeyIndicator
│               ├── ErrorBoundary
│               │   └── ContentLoadingGate
│               │       └── [Page Component]
│               │           └── [Feature Components]
│               ├── DataMigrationDialog
│               └── Toaster
```

## Key Components

### Navigation
**File:** `components/navigation.tsx`

Top navigation bar with route links.

```typescript
// Routes
- Dashboard (/)
- Database (/database)
- Schema (/schema)
- Query (/query)
- Reports (/reports)
```

Features:
- Active route highlighting (blue indicator)
- Theme toggle (dark/light mode)
- API key status indicator (when rate limiting enabled)
- Mobile responsive with collapsible menu
- Skips rendering on /landing page

### SchemaExplorer
**File:** `components/schema-explorer.tsx`

Interactive schema browser for viewing and editing database structure.

Features:
- Expandable table list
- Column details with types
- Edit descriptions inline
- Generate AI descriptions
- Hide/show tables and columns
- Bulk operations

Props:
```typescript
interface SchemaExplorerProps {
  schema: Schema;
  onSchemaUpdate: (schema: Schema) => void;
  readOnly?: boolean;
}
```

### QueryResultsDisplay
**File:** `components/query-results-display.tsx`

Displays query results with multiple view modes.

Features:
- Table view with sorting/filtering
- Pagination
- Search across results
- Export to CSV
- Chart visualization mode
- Row count and execution time
- Automatic column type detection (text, number, currency, date, URL)
- Manual column type override via header badge dropdown

Props:
```typescript
interface QueryResultsProps {
  data: {
    columns: string[];
    rows: DataRows;
    rowCount: number;
    executionTime: number;
  };
  initialChartConfig?: ChartConfig;        // seed a saved chart (no AI call)
  onChartConfigChange?: (config: ChartConfig | null) => void;
  onSaveChart?: (config: ChartConfig) => void;  // shows "Save chart to report"
}
```

### ChartDisplay
**File:** `components/chart-display.tsx`

Renders charts based on configuration.

Features:
- Multiple chart types (bar, line, pie, area, scatter, composed)
- Responsive sizing
- Legend toggle

Props:
```typescript
interface ChartDisplayProps {
  config: ChartConfig;   // type: "bar" | "line" | "pie" | "area" | "scatter" | "composed"
  columns: string[];
  rows: DataRows;
}
```

### SavedReports
**File:** `components/saved-reports.tsx`

List and management of saved reports.

Features:
- Filter by active connection
- Search reports
- Run reports (with parameter input)
- Edit/delete reports
- Clone reports (same connection)
- Copy reports to another connection (for dev/staging/prod workflows)
- Favorite reports

### SaveReportDialog
**File:** `components/save-report-dialog.tsx`

Dialog for saving queries as reports.

Features:
- Name and description input
- Parameter configuration
- SQL preview

---

## Page Components

Detailed documentation: [Page Components](./pages.md)

| Page | Route | File |
|------|-------|------|
| Dashboard | `/` | `app/page.tsx` |
| Database | `/database` | `app/database/page.tsx` |
| Schema | `/schema` | `app/schema/page.tsx` |
| Query | `/query` | `app/query/page.tsx` |
| Reports | `/reports` | `app/reports/page.tsx` |
| Admin | `/admin` | `app/admin/page.tsx` |
| Landing | `/landing` | `app/landing/page.tsx` |
| Auth Login | `/auth/login` | `app/auth/login/page.tsx` |

---

## Feature Components

Detailed documentation: [Feature Components](./features.md)

### Report Components
- `saved-reports.tsx` - Report list
- `save-report-dialog.tsx` - Save dialog
- `edit-report-dialog.tsx` - Edit dialog
- `parameter-config.tsx` - Parameter setup
- `parameter-input-dialog.tsx` - Parameter input

### Chart Components
- `chart-display.tsx` - Main chart renderer
- `chart-customizer.tsx` - Live chart-config editor (type/columns/labels/colors) + `reshapeChartConfig`
- `charts/bar-chart.tsx` - Bar chart
- `charts/line-chart.tsx` - Line chart
- `charts/pie-chart.tsx` - Pie chart
- `charts/area-chart.tsx` - Area chart
- `charts/scatter-chart.tsx` - Scatter plot
- `charts/composed-chart.tsx` - Mixed bars/lines/areas on shared axes

### Dashboard Components
- `executive-metrics.tsx` - Pinned-report KPI cards (wired to real query results)
- `performance-chart.tsx` - Pinned-report trend chart (wired to real query results)
- `quick-actions.tsx` - Quick action buttons (New Query, Reports, etc.)
- `recent-reports.tsx` - Recent reports display
- `scheduled-reports.tsx` - Demo scheduled-delivery UI (hardcoded data)
- `report-templates.tsx` - Demo report template gallery (hardcoded data)

### Query Components
- `query-tab-content.tsx` - Individual query tab with SQL, results, actions
- `followup-dialog.tsx` - Follow-up question dialog with row limit selector

### Infrastructure & Cross-Cutting Components

Detailed documentation: [Infrastructure Components](./infrastructure.md)

- `auth-provider.tsx` - Conditional next-auth SessionProvider
- `content-loading-gate.tsx` - Loading gate until context is initialized
- `data-migration-dialog.tsx` - Import localStorage data on first authenticated login
- `share-dialog.tsx` - Share connections/reports with other users
- `confirmation-modal.tsx` - Generic confirm/cancel dialog
- `error-boundary.tsx` - React error boundary with fallback UI
- `openai-api-provider.tsx` - OpenAI API key (BYOK) context provider
- `api-key-dialog.tsx` / `api-key-indicator.tsx` - BYOK key entry and status indicator
- `navigation.tsx`, `theme-provider.tsx`, `theme-toggle.tsx` - Navigation and theming

---

## shadcn/ui Components

**Location:** `components/ui/`

**Important:** Do not manually edit these files. Use shadcn CLI to update.

Common components used:
- `button.tsx` - Button variants
- `card.tsx` - Card container
- `dialog.tsx` - Modal dialogs
- `dropdown-menu.tsx` - Dropdown menus
- `input.tsx` - Text inputs
- `select.tsx` - Select dropdowns
- `table.tsx` - Data tables
- `tabs.tsx` - Tab navigation
- `toast.tsx` - Notifications

Adding new shadcn components:
```bash
npx shadcn@latest add [component-name]
```

---

## Component Patterns

### Using Context

```typescript
import { useDatabaseOptions } from '@/lib/database-connection-options';

function MyComponent() {
  const { currentConnection, currentSchema } = useDatabaseOptions();

  if (!currentConnection) {
    return <NoConnectionMessage />;
  }

  return <ComponentContent />;
}
```

### Conditional Rendering

```typescript
// Check for data before rendering
{currentSchema && <SchemaExplorer schema={currentSchema} />}

// Loading state
{isLoading ? <Spinner /> : <Content />}

// Error state
{error && <Alert variant="destructive">{error}</Alert>}
```

### Toast Notifications

```typescript
import { useToast } from '@/hooks/use-toast';

function MyComponent() {
  const { toast } = useToast();

  const handleSuccess = () => {
    toast({
      title: "Success",
      description: "Operation completed"
    });
  };

  const handleError = (error: Error) => {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive"
    });
  };
}
```

---

## Related Documentation
- [Page Components](./pages.md) - App router pages
- [Feature Components](./features.md) - Feature implementations
- [Infrastructure Components](./infrastructure.md) - Providers, navigation, theme, auth, modals
- [State Management](../architecture/state-management.md) - Context usage
