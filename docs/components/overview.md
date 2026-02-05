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
│   └── OpenAIApiProvider (API key context)
│       └── DatabaseConnectionOptions (state context)
│           ├── Navigation
│           │   └── ApiKeyIndicator
│           ├── ErrorBoundary
│           │   └── [Page Component]
│           │       └── [Feature Components]
│           └── Toaster
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
interface QueryResultsDisplayProps {
  columns: string[];
  rows: string[][];
  rowCount: number;
  executionTime: number;
  onVisualize?: () => void;
}
```

### ChartDisplay
**File:** `components/chart-display.tsx`

Renders charts based on configuration.

Features:
- Multiple chart types (bar, line, pie, area, scatter)
- Responsive sizing
- Legend toggle
- Download as image

Props:
```typescript
interface ChartDisplayProps {
  config: ChartConfig;
  data: any[];
}
```

### SavedReports
**File:** `components/saved-reports.tsx`

List and management of saved reports.

Features:
- Filter by connection
- Search reports
- Run reports
- Edit/delete reports
- Export/import

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
| Landing | `/landing` | `app/landing/page.tsx` |

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
- `charts/bar-chart.tsx` - Bar chart
- `charts/line-chart.tsx` - Line chart
- `charts/pie-chart.tsx` - Pie chart
- `charts/area-chart.tsx` - Area chart
- `charts/scatter-chart.tsx` - Scatter plot

### Dashboard Components
- `executive-metrics.tsx` - Static high-level metric cards
- `quick-actions.tsx` - Quick action buttons (New Query, Reports, etc.)
- `recent-reports.tsx` - Recent reports display
- `performance-chart.tsx` - Mock performance visualization

### Query Components
- `query-tab-content.tsx` - Individual query tab with SQL, results, actions
- `followup-dialog.tsx` - Follow-up question dialog with row limit selector

### Infrastructure Components
- `error-boundary.tsx` - React error boundary with fallback UI
- `openai-api-provider.tsx` - OpenAI API key context provider
- `api-key-dialog.tsx` - Dialog for entering OpenAI API key
- `api-key-indicator.tsx` - Navigation indicator showing API key status

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

## Theme Components

### ThemeProvider
**File:** `components/theme-provider.tsx`

Wrapper for next-themes providing dark/light mode.

### ThemeToggle
**File:** `components/theme-toggle.tsx`

Button to toggle between dark and light themes.

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
- [State Management](../architecture/state-management.md) - Context usage
