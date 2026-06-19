import type { ParameterDefaultValue } from './common-types';
import type { ChartConfig } from './chart-config.interface';

export interface ReportParameter {
  name: string;
  type: 'text' | 'number' | 'date' | 'datetime' | 'boolean';
  label: string;
  defaultValue?: ParameterDefaultValue;
  description?: string;
}

export interface SavedReport {
  id: string;
  connectionId: string;
  name: string;
  description?: string;

  // Query information
  naturalLanguageQuery: string;  // Original prompt
  sql: string;                   // Generated SQL (may contain {{parameters}})
  explanation: string;           // AI explanation
  warnings: string[];            // Any warnings
  confidence: number;            // AI confidence score

  // Parameters
  parameters?: ReportParameter[];

  // Metadata
  createdAt: string;
  lastModified: string;
  lastRun?: string;

  // Future: visualization settings
  isFavorite?: boolean;

  // Optional: the report's saved chart. When set, re-running the report renders
  // this chart immediately (no AI generation) and the dashboard chart widget uses it.
  visualization?: ChartConfig;

  // Optional: pins this report to the dashboard as a KPI metric or trend chart
  dashboardWidget?: DashboardWidgetConfig;

  // Origin of the report: "local" (user-created) or "server" (loaded from config/reports.json, read-only)
  source?: "local" | "server";

  // Sharing (auth mode only). Set server-side by getReportsForUser.
  // undefined ⇒ owned (e.g. localStorage mode); "owner" ⇒ owned in auth mode;
  // "view"/"edit" ⇒ shared with the current user at that permission.
  accessLevel?: "owner" | "view" | "edit";
  sharedByEmail?: string;   // owner's email, shown on "Shared with you" items
  sharedByName?: string | null;
}

/**
 * Marks a saved report as a dashboard widget. When set, the dashboard runs the
 * report's SQL on load and renders the result as either a KPI card
 * (ExecutiveMetrics) or a trend chart (PerformanceChart).
 */
export interface DashboardWidgetConfig {
  kind: 'metric' | 'chart';

  // metric only — the KPI's value is rows[0][0] of the report's result
  target?: number;
  unit?: 'number' | 'currency' | 'percent';
  higherIsBetter?: boolean;   // default true

  // chart only — optional cached config; generated on the fly when absent
  chartConfig?: ChartConfig;
}
