"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Target, AlertCircle, CheckCircle } from "lucide-react"

const metrics = [
  {
    title: "Revenue Growth",
    value: "12.5%",
    target: "15%",
    status: "on-track",
    description: "Monthly recurring revenue growth",
  },
  {
    title: "Customer Satisfaction",
    value: "4.8/5",
    target: "4.5/5",
    status: "exceeding",
    description: "Average customer rating",
  },
  {
    title: "Market Share",
    value: "23.4%",
    target: "25%",
    status: "behind",
    description: "Industry market position",
  },
  {
    title: "Operational Efficiency",
    value: "87%",
    target: "85%",
    status: "exceeding",
    description: "Process optimization score",
  },
]

export function ExecutiveMetrics() {
  const getStatusIcon = (status: string) => {
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

  const getStatusColor = (status: string) => {
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
              <p className="text-sm text-slate-600">{metric.description}</p>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900">{metric.value}</span>
                <Badge variant="outline" className={getStatusColor(metric.status)}>
                  Target: {metric.target}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
