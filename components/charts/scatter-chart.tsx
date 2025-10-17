"use client"

import {
  ScatterChart as RechartsScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from "recharts"
import { ScatterChartConfig } from "@/models/chart-config.interface"

interface ScatterChartProps {
  data: Record<string, any>[]
  config: ScatterChartConfig
}

const DEFAULT_COLOR = "#3b82f6"

export function ScatterChartComponent({ data, config }: ScatterChartProps) {
  const color = config.color || DEFAULT_COLOR

  // Convert X and Y axis columns to actual numbers
  const processedData = data.map((row) => {
    const newRow = { ...row }

    // Convert X axis
    const xValue = row[config.xAxisColumn]
    if (xValue !== null && xValue !== undefined && xValue !== "") {
      const numValue = Number(xValue)
      if (!isNaN(numValue)) {
        newRow[config.xAxisColumn] = numValue
      }
    }

    // Convert Y axis
    const yValue = row[config.yAxisColumn]
    if (yValue !== null && yValue !== undefined && yValue !== "") {
      const numValue = Number(yValue)
      if (!isNaN(numValue)) {
        newRow[config.yAxisColumn] = numValue
      }
    }

    return newRow
  })

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RechartsScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
        <XAxis
          type="number"
          dataKey={config.xAxisColumn}
          name={config.xAxisLabel || config.xAxisColumn}
          domain={["auto", "auto"]}
          label={config.xAxisLabel ? { value: config.xAxisLabel, position: "insideBottom", offset: -5 } : undefined}
          className="text-slate-600 dark:text-slate-400"
        />
        <YAxis
          type="number"
          dataKey={config.yAxisColumn}
          name={config.yAxisLabel || config.yAxisColumn}
          domain={["auto", "auto"]}
          label={config.yAxisLabel ? { value: config.yAxisLabel, angle: -90, position: "insideLeft" } : undefined}
          className="text-slate-600 dark:text-slate-400"
        />
        <ZAxis range={[60, 60]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
        />
        <Scatter name={config.nameColumn || "Data Points"} data={data} fill={color} />
      </RechartsScatterChart>
    </ResponsiveContainer>
  )
}
