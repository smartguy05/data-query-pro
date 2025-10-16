"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BarChart3, Info } from "lucide-react"
import { ChartConfig } from "@/models/chart-config.interface"
import { BarChartComponent } from "@/components/charts/bar-chart"
import { LineChartComponent } from "@/components/charts/line-chart"
import { PieChartComponent } from "@/components/charts/pie-chart"
import { AreaChartComponent } from "@/components/charts/area-chart"
import { ScatterChartComponent } from "@/components/charts/scatter-chart"

interface ChartDisplayProps {
  config: ChartConfig
  columns: string[]
  rows: any[][]
}

export function ChartDisplay({ config, columns, rows }: ChartDisplayProps) {
  // Transform rows array into array of objects for Recharts
  const data = rows.map((row) => {
    const obj: Record<string, any> = {}
    columns.forEach((col, index) => {
      obj[col] = row[index]
    })
    return obj
  })

  const renderChart = () => {
    switch (config.type) {
      case "bar":
        return <BarChartComponent data={data} config={config} />
      case "line":
        return <LineChartComponent data={data} config={config} />
      case "pie":
        return <PieChartComponent data={data} config={config} />
      case "area":
        return <AreaChartComponent data={data} config={config} />
      case "scatter":
        return <ScatterChartComponent data={data} config={config} />
      case "composed":
        return (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>Composed charts are not yet implemented</AlertDescription>
          </Alert>
        )
      default:
        return (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>Unknown chart type: {(config as any).type}</AlertDescription>
          </Alert>
        )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          {config.title || "Data Visualization"}
        </CardTitle>
        {config.description && <CardDescription>{config.description}</CardDescription>}
      </CardHeader>
      <CardContent>{renderChart()}</CardContent>
    </Card>
  )
}
