"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, Target, AlertCircle, CheckCircle, X } from "lucide-react"

export type KpiStatus = "exceeding" | "on-track" | "behind" | "neutral"

export interface KpiMetric {
  reportId: string
  title: string
  description?: string
  value: string
  target?: string
  status: KpiStatus
}

export function ExecutiveMetrics({
  metrics,
  onRemove,
}: {
  metrics: KpiMetric[]
  onRemove?: (reportId: string) => void
}) {
  if (!metrics || metrics.length === 0) return null

  const getStatusIcon = (status: KpiStatus) => {
    switch (status) {
      case "exceeding":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "on-track":
        return <TrendingUp className="h-4 w-4 text-blue-600" />
      case "behind":
        return <AlertCircle className="h-4 w-4 text-orange-600" />
      default:
        return <Target className="h-4 w-4 text-slate-400" />
    }
  }

  const getStatusColor = (status: KpiStatus) => {
    switch (status) {
      case "exceeding":
        return "bg-green-100 text-green-700 border-green-200"
      case "on-track":
        return "bg-blue-100 text-blue-700 border-blue-200"
      case "behind":
        return "bg-orange-100 text-orange-700 border-orange-200"
      default:
        return "bg-slate-100 text-slate-700 border-slate-200"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-600" />
          Executive Metrics
        </CardTitle>
        <CardDescription>Key performance indicators vs targets</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-slate-900">{metric.title}</h4>
                {getStatusIcon(metric.status)}
              </div>
              {metric.description && <p className="text-sm text-slate-600">{metric.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right space-y-1">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-lg font-bold text-slate-900">{metric.value}</span>
                  {metric.target && (
                    <Badge variant="outline" className={getStatusColor(metric.status)}>
                      Target: {metric.target}
                    </Badge>
                  )}
                </div>
              </div>
              {onRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-slate-700"
                  title="Remove from dashboard"
                  aria-label={`Remove ${metric.title} from dashboard`}
                  onClick={() => onRemove(metric.reportId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
