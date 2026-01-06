/**
 * Chart configuration types for AI-powered data visualization
 */

import type { DataRows, ToolParameterProperties } from './common-types';

export type ChartType = "bar" | "line" | "pie" | "area" | "scatter" | "composed"

export interface ChartToolDefinition {
  type: "function"
  function: {
    name: string
    description: string
    parameters: {
      type: "object"
      properties: ToolParameterProperties
      required: string[]
    }
  }
}

export interface BaseChartConfig {
  type: ChartType
  title?: string
  description?: string
}

export interface BarChartConfig extends BaseChartConfig {
  type: "bar"
  xAxisColumn: string
  yAxisColumns: string[]
  xAxisLabel?: string
  yAxisLabel?: string
  colors?: string[]
  stacked?: boolean
}

export interface LineChartConfig extends BaseChartConfig {
  type: "line"
  xAxisColumn: string
  yAxisColumns: string[]
  xAxisLabel?: string
  yAxisLabel?: string
  colors?: string[]
  smooth?: boolean
  showDots?: boolean
}

export interface PieChartConfig extends BaseChartConfig {
  type: "pie"
  nameColumn: string
  valueColumn: string
  colors?: string[]
  showLabels?: boolean
}

export interface AreaChartConfig extends BaseChartConfig {
  type: "area"
  xAxisColumn: string
  yAxisColumns: string[]
  xAxisLabel?: string
  yAxisLabel?: string
  colors?: string[]
  stacked?: boolean
}

export interface ScatterChartConfig extends BaseChartConfig {
  type: "scatter"
  xAxisColumn: string
  yAxisColumn: string
  nameColumn?: string
  xAxisLabel?: string
  yAxisLabel?: string
  color?: string
}

export interface ComposedChartConfig extends BaseChartConfig {
  type: "composed"
  xAxisColumn: string
  lines?: string[]
  bars?: string[]
  areas?: string[]
  xAxisLabel?: string
  yAxisLabel?: string
  colors?: string[]
}

export type ChartConfig =
  | BarChartConfig
  | LineChartConfig
  | PieChartConfig
  | AreaChartConfig
  | ScatterChartConfig
  | ComposedChartConfig

export interface ChartGenerationRequest {
  columns: string[]
  rows: DataRows
  rowCount: number
  preferredChartType?: ChartType
}

export interface ChartGenerationResponse {
  config: ChartConfig
  reasoning?: string
}

/**
 * Chart tool definitions for OpenAI function calling
 */
export const CHART_TOOLS: ChartToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "create_bar_chart",
      description:
        "Create a vertical or horizontal bar chart for comparing categorical data across different categories. Best for: comparing discrete categories, showing rankings, displaying counts or totals",
      parameters: {
        type: "object",
        properties: {
          xAxisColumn: {
            type: "string",
            description: "Column name to use for the X-axis (categories)",
          },
          yAxisColumns: {
            type: "array",
            items: { type: "string" },
            description: "Column name(s) to use for the Y-axis (numeric values). Can be multiple for grouped bars",
          },
          xAxisLabel: {
            type: "string",
            description: "Optional label for X-axis",
          },
          yAxisLabel: {
            type: "string",
            description: "Optional label for Y-axis",
          },
          colors: {
            type: "array",
            items: { type: "string" },
            description: "Optional array of hex color codes for each series",
          },
          stacked: {
            type: "boolean",
            description: "Whether to stack bars on top of each other",
          },
          title: {
            type: "string",
            description: "Optional chart title",
          },
          description: {
            type: "string",
            description: "Optional explanation of what the chart shows",
          },
        },
        required: ["xAxisColumn", "yAxisColumns"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_line_chart",
      description:
        "Create a line chart for showing trends over time or continuous data. Best for: time series data, showing trends, tracking changes over continuous ranges",
      parameters: {
        type: "object",
        properties: {
          xAxisColumn: {
            type: "string",
            description: "Column name for X-axis (typically time or sequential data)",
          },
          yAxisColumns: {
            type: "array",
            items: { type: "string" },
            description: "Column name(s) for Y-axis (numeric values). Can be multiple for multi-line charts",
          },
          xAxisLabel: {
            type: "string",
            description: "Optional label for X-axis",
          },
          yAxisLabel: {
            type: "string",
            description: "Optional label for Y-axis",
          },
          colors: {
            type: "array",
            items: { type: "string" },
            description: "Optional array of hex color codes for each line",
          },
          smooth: {
            type: "boolean",
            description: "Whether to use smooth curves instead of straight lines",
          },
          showDots: {
            type: "boolean",
            description: "Whether to show dots at data points",
          },
          title: {
            type: "string",
            description: "Optional chart title",
          },
          description: {
            type: "string",
            description: "Optional explanation of what the chart shows",
          },
        },
        required: ["xAxisColumn", "yAxisColumns"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_pie_chart",
      description:
        "Create a pie chart for showing proportions and percentages. Best for: showing parts of a whole, displaying percentage breakdowns, comparing composition",
      parameters: {
        type: "object",
        properties: {
          nameColumn: {
            type: "string",
            description: "Column name for slice labels (categories)",
          },
          valueColumn: {
            type: "string",
            description: "Column name for slice values (numeric)",
          },
          colors: {
            type: "array",
            items: { type: "string" },
            description: "Optional array of hex color codes for each slice",
          },
          showLabels: {
            type: "boolean",
            description: "Whether to show percentage labels on slices",
          },
          title: {
            type: "string",
            description: "Optional chart title",
          },
          description: {
            type: "string",
            description: "Optional explanation of what the chart shows",
          },
        },
        required: ["nameColumn", "valueColumn"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_area_chart",
      description:
        "Create an area chart for showing cumulative trends over time. Best for: visualizing volume or magnitude over time, showing cumulative totals, stacked time series",
      parameters: {
        type: "object",
        properties: {
          xAxisColumn: {
            type: "string",
            description: "Column name for X-axis (typically time or sequential data)",
          },
          yAxisColumns: {
            type: "array",
            items: { type: "string" },
            description: "Column name(s) for Y-axis (numeric values). Can be multiple for stacked areas",
          },
          xAxisLabel: {
            type: "string",
            description: "Optional label for X-axis",
          },
          yAxisLabel: {
            type: "string",
            description: "Optional label for Y-axis",
          },
          colors: {
            type: "array",
            items: { type: "string" },
            description: "Optional array of hex color codes for each area",
          },
          stacked: {
            type: "boolean",
            description: "Whether to stack areas on top of each other",
          },
          title: {
            type: "string",
            description: "Optional chart title",
          },
          description: {
            type: "string",
            description: "Optional explanation of what the chart shows",
          },
        },
        required: ["xAxisColumn", "yAxisColumns"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_scatter_plot",
      description:
        "Create a scatter plot for showing correlation between two variables. Best for: correlation analysis, distribution patterns, outlier detection",
      parameters: {
        type: "object",
        properties: {
          xAxisColumn: {
            type: "string",
            description: "Column name for X-axis (numeric)",
          },
          yAxisColumn: {
            type: "string",
            description: "Column name for Y-axis (numeric)",
          },
          nameColumn: {
            type: "string",
            description: "Optional column for point labels",
          },
          xAxisLabel: {
            type: "string",
            description: "Optional label for X-axis",
          },
          yAxisLabel: {
            type: "string",
            description: "Optional label for Y-axis",
          },
          color: {
            type: "string",
            description: "Optional hex color code for points",
          },
          title: {
            type: "string",
            description: "Optional chart title",
          },
          description: {
            type: "string",
            description: "Optional explanation of what the chart shows",
          },
        },
        required: ["xAxisColumn", "yAxisColumn"],
      },
    },
  },
]
