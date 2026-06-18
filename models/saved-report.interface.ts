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

  // Optional: pins this report to the dashboard as a KPI metric or trend chart
  dashboardWidget?: DashboardWidgetConfig;

  // Origin of the report: "local" (user-created) or "server" (loaded from config/reports.json, read-only)
  source?: "local" | "server";
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
