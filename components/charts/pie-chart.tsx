"use client"

import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { PieChartConfig } from "@/models/chart-config.interface"

interface PieChartProps {
  data: Record<string, any>[]
  config: PieChartConfig
}

const DEFAULT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"]

export function PieChartComponent({ data, config }: PieChartProps) {
  const colors = config.colors || DEFAULT_COLORS

  // Convert value column to actual numbers
  const processedData = data.map((row) => {
    const newRow = { ...row }
    const value = row[config.valueColumn]
    if (value !== null && value !== undefined && value !== "") {
      const numValue = Number(value)
      if (!isNaN(numValue)) {
        newRow[config.valueColumn] = numValue
      }
    }
    return newRow
  })

  const renderLabel = (entry: any) => {
    const percent = ((entry.value / processedData.reduce((sum, item) => sum + item[config.valueColumn], 0)) * 100).toFixed(1)
    return `${entry[config.nameColumn]}: ${percent}%`
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RechartsPieChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <Pie
          data={processedData}
          dataKey={config.valueColumn}
          nameKey={config.nameColumn}
          cx="50%"
          cy="50%"
          outerRadius={120}
          label={config.showLabels !== false ? renderLabel : false}
          labelLine={config.showLabels !== false}
        >
          {processedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
          }}
        />
        <Legend />
      </RechartsPieChart>
    </ResponsiveContainer>
  )
}
