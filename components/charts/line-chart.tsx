"use client"

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { LineChartConfig } from "@/models/chart-config.interface"

interface LineChartProps {
  data: Record<string, any>[]
  config: LineChartConfig
}

const DEFAULT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

export function LineChartComponent({ data, config }: LineChartProps) {
  const colors = config.colors || DEFAULT_COLORS

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RechartsLineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
        <XAxis
          dataKey={config.xAxisColumn}
          label={config.xAxisLabel ? { value: config.xAxisLabel, position: "insideBottom", offset: -5 } : undefined}
          className="text-slate-600 dark:text-slate-400"
        />
        <YAxis
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
        {config.yAxisColumns.length > 1 && <Legend />}
        {config.yAxisColumns.map((column, index) => (
          <Line
            key={column}
            type={config.smooth ? "monotone" : "linear"}
            dataKey={column}
            stroke={colors[index % colors.length]}
            strokeWidth={2}
            dot={config.showDots !== false}
            activeDot={{ r: 6 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  )
}
