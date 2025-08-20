"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Clock, Eye, Download } from "lucide-react"

const recentReports = [
  {
    id: 1,
    name: "Q4 Financial Summary",
    type: "Financial",
    generatedAt: "2024-01-15 09:30",
    status: "completed",
    size: "2.4 MB",
  },
  {
    id: 2,
    name: "Customer Acquisition Report",
    type: "Marketing",
    generatedAt: "2024-01-14 14:15",
    status: "completed",
    size: "1.8 MB",
  },
  {
    id: 3,
    name: "Sales Performance Analysis",
    type: "Sales",
    generatedAt: "2024-01-13 11:45",
    status: "completed",
    size: "3.1 MB",
  },
  {
    id: 4,
    name: "Operational Metrics Dashboard",
    type: "Operations",
    generatedAt: "2024-01-12 16:20",
    status: "processing",
    size: "Pending",
  },
]

export function RecentReports() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Recent Reports
            </CardTitle>
            <CardDescription>Latest generated executive reports</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentReports.map((report) => (
          <div key={report.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-slate-900">{report.name}</h4>
                <Badge variant="outline">{report.type}</Badge>
                {report.status === "processing" && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                    Processing
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(report.generatedAt).toLocaleString()}
                </div>
                <span>{report.size}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost">
                <Eye className="h-4 w-4" />
              </Button>
              {report.status === "completed" && (
                <Button size="sm" variant="ghost">
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
