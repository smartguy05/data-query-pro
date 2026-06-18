"use client"

import { ChartDisplay } from "@/components/chart-display"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import type { ChartConfig } from "@/models/chart-config.interface"
import type { DataRows } from "@/models/common-types"

interface PerformanceChartProps {
  config: ChartConfig
  columns: string[]
  rows: DataRows
  title?: string
  description?: string
  onRemove?: () => void
}

/**
 * Dashboard trend widget. Thin wrapper around the shared ChartDisplay renderer
 * (which switches over the real Recharts components in components/charts/*).
 * `title`/`description` override the chart config's own header text so the
 * widget reflects the pinned report's name. When `onRemove` is provided, a
 * remove-from-dashboard button is overlaid in the card's top-right corner.
 */
export function PerformanceChart({ config, columns, rows, title, description, onRemove }: PerformanceChartProps) {
  const mergedConfig: ChartConfig = {
    ...config,
    title: title ?? config.title,
    description: description ?? config.description,
  }

  if (!onRemove) {
    return <ChartDisplay config={mergedConfig} columns={columns} rows={rows} />
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 z-10 h-7 w-7 text-muted-foreground hover:text-foreground"
        title="Remove from dashboard"
        aria-label="Remove chart from dashboard"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
      <ChartDisplay config={mergedConfig} columns={columns} rows={rows} />
    </div>
  )
}
