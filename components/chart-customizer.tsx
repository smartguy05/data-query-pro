"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Settings2 } from "lucide-react"
import type { ChartConfig, ChartType } from "@/models/chart-config.interface"

// Matches the palette used by the chart renderers (components/charts/*)
export const CHART_PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

interface ChartCustomizerProps {
  config: ChartConfig
  columns: string[]
  onChange: (config: ChartConfig) => void
}

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "pie", label: "Pie" },
  { value: "scatter", label: "Scatter" },
  { value: "composed", label: "Composed" },
]

// --- Reshape helpers: carry column choices across chart shapes ---

function getX(prev?: ChartConfig): string | undefined {
  if (!prev) return undefined
  if (prev.type === "pie") return prev.nameColumn
  return (prev as { xAxisColumn?: string }).xAxisColumn
}

function getSeries(prev?: ChartConfig): string[] {
  if (!prev) return []
  switch (prev.type) {
    case "bar":
    case "line":
    case "area":
      return prev.yAxisColumns ?? []
    case "scatter":
      return prev.yAxisColumn ? [prev.yAxisColumn] : []
    case "pie":
      return prev.valueColumn ? [prev.valueColumn] : []
    case "composed":
      return [...(prev.bars ?? []), ...(prev.areas ?? []), ...(prev.lines ?? [])]
    default:
      return []
  }
}

/**
 * Build a config of `newType` that preserves as much of `prev` as possible
 * (title/description/colors and column choices), filling defaults from `columns`.
 */
export function reshapeChartConfig(
  prev: ChartConfig | undefined,
  newType: ChartType,
  columns: string[]
): ChartConfig {
  const title = prev?.title
  const description = prev?.description
  const colors = (prev as { colors?: string[] } | undefined)?.colors

  const x = getX(prev) ?? columns[0] ?? ""
  const prevSeries = getSeries(prev).filter((c) => columns.includes(c))
  const series = prevSeries.length ? prevSeries : columns.filter((c) => c !== x).slice(0, 1)
  const firstSeries = series[0] ?? columns.find((c) => c !== x) ?? columns[0] ?? ""

  switch (newType) {
    case "bar":
      return { type: "bar", title, description, colors, xAxisColumn: x, yAxisColumns: series }
    case "line":
      return { type: "line", title, description, colors, xAxisColumn: x, yAxisColumns: series, showDots: true }
    case "area":
      return { type: "area", title, description, colors, xAxisColumn: x, yAxisColumns: series }
    case "pie":
      return { type: "pie", title, description, colors, nameColumn: x, valueColumn: firstSeries, showLabels: true }
    case "scatter":
      return { type: "scatter", title, description, color: colors?.[0], xAxisColumn: x, yAxisColumn: firstSeries }
    case "composed":
      return { type: "composed", title, description, colors, xAxisColumn: x, bars: series, areas: [], lines: [] }
    default:
      return { type: "bar", title, description, colors, xAxisColumn: x, yAxisColumns: series }
  }
}

// The ordered list of series used for color assignment (mirrors each renderer's order)
function colorSeries(config: ChartConfig): string[] {
  switch (config.type) {
    case "bar":
    case "line":
    case "area":
      return config.yAxisColumns ?? []
    case "composed":
      return [...(config.bars ?? []), ...(config.areas ?? []), ...(config.lines ?? [])]
    default:
      return []
  }
}

function ColorField({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      {CHART_PALETTE.map((hex) => (
        <button
          key={hex}
          type="button"
          aria-label={`Use ${hex}`}
          onClick={() => onChange(hex)}
          className={`h-5 w-5 rounded-full border ${value?.toLowerCase() === hex.toLowerCase() ? "ring-2 ring-offset-1 ring-slate-400" : ""}`}
          style={{ backgroundColor: hex }}
        />
      ))}
      <input
        type="color"
        value={value || "#3b82f6"}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 cursor-pointer rounded border bg-transparent p-0"
        aria-label="Custom color"
      />
    </div>
  )
}

export function ChartCustomizer({ config, columns, onChange }: ChartCustomizerProps) {
  const patch = (changes: Partial<ChartConfig>) => onChange({ ...config, ...changes } as ChartConfig)

  const toggleInArray = (key: "yAxisColumns" | "bars" | "lines" | "areas", col: string) => {
    const current = ((config as unknown as Record<string, string[] | undefined>)[key]) ?? []
    const next = current.includes(col) ? current.filter((c) => c !== col) : [...current, col]
    patch({ [key]: next } as Partial<ChartConfig>)
  }

  const ColumnCheckList = ({
    selected,
    onToggle,
  }: {
    selected: string[]
    onToggle: (col: string) => void
  }) => (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
      {columns.map((col) => (
        <label key={col} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
          <Checkbox checked={selected.includes(col)} onCheckedChange={() => onToggle(col)} />
          <span className="truncate">{col}</span>
        </label>
      ))}
    </div>
  )

  const SingleColumnSelect = ({
    value,
    onValueChange,
    placeholder,
  }: {
    value?: string
    onValueChange: (v: string) => void
    placeholder: string
  }) => (
    <Select value={value || ""} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {columns.map((col) => (
          <SelectItem key={col} value={col}>
            {col}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const hasAxes = config.type !== "pie"
  const colorCols = colorSeries(config)

  return (
    <Card className="border-blue-200 dark:border-blue-900">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-blue-600" />
          Customize Chart
        </CardTitle>
        <CardDescription>Adjust the chart type, columns, labels, and colors. Changes preview live.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chart type + title */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Chart Type</Label>
            <Select
              value={config.type}
              onValueChange={(v) => onChange(reshapeChartConfig(config, v as ChartType, columns))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="chart-title">Title</Label>
            <Input
              id="chart-title"
              placeholder="Chart title"
              value={config.title || ""}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </div>
        </div>

        {/* Column mapping */}
        <div className="space-y-3 p-4 border rounded-lg">
          {(config.type === "bar" || config.type === "line" || config.type === "area") && (
            <>
              <div className="space-y-2">
                <Label>X-Axis Column</Label>
                <SingleColumnSelect
                  value={config.xAxisColumn}
                  onValueChange={(v) => patch({ xAxisColumn: v })}
                  placeholder="Select X-axis column"
                />
              </div>
              <div className="space-y-2">
                <Label>Y-Axis Columns (series)</Label>
                <ColumnCheckList
                  selected={config.yAxisColumns ?? []}
                  onToggle={(c) => toggleInArray("yAxisColumns", c)}
                />
              </div>
            </>
          )}

          {config.type === "pie" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category (name) Column</Label>
                <SingleColumnSelect
                  value={config.nameColumn}
                  onValueChange={(v) => patch({ nameColumn: v })}
                  placeholder="Select category column"
                />
              </div>
              <div className="space-y-2">
                <Label>Value Column</Label>
                <SingleColumnSelect
                  value={config.valueColumn}
                  onValueChange={(v) => patch({ valueColumn: v })}
                  placeholder="Select value column"
                />
              </div>
            </div>
          )}

          {config.type === "scatter" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>X-Axis Column</Label>
                <SingleColumnSelect
                  value={config.xAxisColumn}
                  onValueChange={(v) => patch({ xAxisColumn: v })}
                  placeholder="X column"
                />
              </div>
              <div className="space-y-2">
                <Label>Y-Axis Column</Label>
                <SingleColumnSelect
                  value={config.yAxisColumn}
                  onValueChange={(v) => patch({ yAxisColumn: v })}
                  placeholder="Y column"
                />
              </div>
              <div className="space-y-2">
                <Label>Point Label (optional)</Label>
                <SingleColumnSelect
                  value={config.nameColumn}
                  onValueChange={(v) => patch({ nameColumn: v })}
                  placeholder="Label column"
                />
              </div>
            </div>
          )}

          {config.type === "composed" && (
            <>
              <div className="space-y-2">
                <Label>X-Axis Column</Label>
                <SingleColumnSelect
                  value={config.xAxisColumn}
                  onValueChange={(v) => patch({ xAxisColumn: v })}
                  placeholder="Select X-axis column"
                />
              </div>
              <div className="space-y-2">
                <Label>Bars</Label>
                <ColumnCheckList selected={config.bars ?? []} onToggle={(c) => toggleInArray("bars", c)} />
              </div>
              <div className="space-y-2">
                <Label>Lines</Label>
                <ColumnCheckList selected={config.lines ?? []} onToggle={(c) => toggleInArray("lines", c)} />
              </div>
              <div className="space-y-2">
                <Label>Areas</Label>
                <ColumnCheckList selected={config.areas ?? []} onToggle={(c) => toggleInArray("areas", c)} />
              </div>
            </>
          )}
        </div>

        {/* Axis labels */}
        {hasAxes && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="x-label">X-Axis Label</Label>
              <Input
                id="x-label"
                placeholder="Optional"
                value={(config as { xAxisLabel?: string }).xAxisLabel || ""}
                onChange={(e) => patch({ xAxisLabel: e.target.value } as Partial<ChartConfig>)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="y-label">Y-Axis Label</Label>
              <Input
                id="y-label"
                placeholder="Optional"
                value={(config as { yAxisLabel?: string }).yAxisLabel || ""}
                onChange={(e) => patch({ yAxisLabel: e.target.value } as Partial<ChartConfig>)}
              />
            </div>
          </div>
        )}

        {/* Display toggles */}
        <div className="flex flex-wrap gap-6">
          {(config.type === "bar" || config.type === "area") && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!config.stacked} onCheckedChange={(v) => patch({ stacked: v } as Partial<ChartConfig>)} />
              Stacked
            </label>
          )}
          {config.type === "line" && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={!!config.smooth} onCheckedChange={(v) => patch({ smooth: v } as Partial<ChartConfig>)} />
                Smooth
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={config.showDots !== false}
                  onCheckedChange={(v) => patch({ showDots: v } as Partial<ChartConfig>)}
                />
                Show dots
              </label>
            </>
          )}
          {config.type === "pie" && (
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={config.showLabels !== false}
                onCheckedChange={(v) => patch({ showLabels: v } as Partial<ChartConfig>)}
              />
              Show labels
            </label>
          )}
        </div>

        {/* Colors */}
        {config.type === "scatter" ? (
          <div className="space-y-2">
            <Label>Point Color</Label>
            <ColorField value={config.color || CHART_PALETTE[0]} onChange={(hex) => patch({ color: hex } as Partial<ChartConfig>)} />
          </div>
        ) : colorCols.length > 0 ? (
          <div className="space-y-2">
            <Label>Series Colors</Label>
            <div className="space-y-2">
              {colorCols.map((col, index) => {
                const colors = (config as { colors?: string[] }).colors ?? []
                const value = colors[index] || CHART_PALETTE[index % CHART_PALETTE.length]
                return (
                  <div key={`${col}-${index}`} className="flex items-center justify-between gap-3">
                    <span className="text-sm truncate">{col}</span>
                    <ColorField
                      value={value}
                      onChange={(hex) => {
                        const next = [...colors]
                        while (next.length < colorCols.length) next.push(CHART_PALETTE[next.length % CHART_PALETTE.length])
                        next[index] = hex
                        patch({ colors: next } as Partial<ChartConfig>)
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
