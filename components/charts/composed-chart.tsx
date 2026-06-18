"use client"

import {
  ComposedChart as RechartsComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { ComposedChartConfig } from "@/models/chart-config.interface"

interface ComposedChartProps {
  data: Record<string, any>[]
  config: ComposedChartConfig
}

const DEFAULT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

export function ComposedChartComponent({ data, config }: ComposedChartProps) {
  const colors = config.colors || DEFAULT_COLORS

  const bars = config.bars ?? []
  const areas = config.areas ?? []
  const lines = config.lines ?? []

  // All numeric series across the three groups
  const numericColumns = [...bars, ...areas, ...lines]

  // Convert numeric columns to actual numbers (same guard as the other chart renderers)
  const processedData = data.map((row) => {
    const newRow = { ...row }
    numericColumns.forEach((col) => {
      const value = row[col]
      if (value !== null && value !== undefined && value !== "") {
        const numValue = Number(value)
        if (!isNaN(numValue)) {
          newRow[col] = numValue
        }
      }
    })
    return newRow
  })

  // Assign a distinct color to each series from a single running index
  let colorIndex = 0
  const nextColor = () => colors[colorIndex++ % colors.length]
  const showLegend = numericColumns.length > 1

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RechartsComposedChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
        <XAxis
          dataKey={config.xAxisColumn}
          label={config.xAxisLabel ? { value: config.xAxisLabel, position: "insideBottom", offset: -5 } : undefined}
          className="text-slate-600 dark:text-slate-400"
        />
        <YAxis
          domain={["auto", "auto"]}
          label={config.yAxisLabel ? { value: config.yAxisLabel, angle: -90, position: "insideLeft" } : undefined}
          className="text-slate-600 dark:text-slate-400"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
          labelStyle={{ color: "hsl(var(--foreground))" }}
        />
        {showLegend && <Legend />}
        {/* Bars first, then areas, then lines so lines render on top */}
        {bars.map((column) => (
          <Bar key={`bar-${column}`} dataKey={column} fill={nextColor()} />
        ))}
        {areas.map((column) => {
          const color = nextColor()
          return (
            <Area
              key={`area-${column}`}
              type="monotone"
              dataKey={column}
              stroke={color}
              fill={color}
              fillOpacity={0.2}
            />
          )
        })}
        {lines.map((column) => (
          <Line
            key={`line-${column}`}
            type="monotone"
            dataKey={column}
            stroke={nextColor()}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </RechartsComposedChart>
    </ResponsiveContainer>
  )
}
