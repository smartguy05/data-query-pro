"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Clock, Calendar, Mail, Pause, Play, Settings, Users } from "lucide-react"

const scheduledReports = [
  {
    id: 1,
    name: "Weekly Sales Summary",
    description: "Sent every Monday at 9 AM",
    frequency: "Weekly",
    nextRun: "2024-01-22 09:00",
    recipients: ["ceo@company.com", "sales@company.com"],
    active: true,
    format: "PDF",
  },
  {
    id: 2,
    name: "Monthly Financial Report",
    description: "Sent on the 1st of each month",
    frequency: "Monthly",
    nextRun: "2024-02-01 08:00",
    recipients: ["cfo@company.com", "finance@company.com"],
    active: true,
    format: "Excel",
  },
  {
    id: 3,
    name: "Daily Inventory Alert",
    description: "Sent daily at 6 AM if stock is low",
    frequency: "Daily",
    nextRun: "2024-01-16 06:00",
    recipients: ["operations@company.com"],
    active: false,
    format: "Email",
  },
  {
    id: 4,
    name: "Quarterly Board Report",
    description: "Comprehensive quarterly business review",
    frequency: "Quarterly",
    nextRun: "2024-04-01 10:00",
    recipients: ["board@company.com"],
    active: true,
    format: "PDF",
  },
]

export function ScheduledReports() {
  const [reports, setReports] = useState(scheduledReports)

  const toggleReport = (reportId: number) => {
    setReports((prev) =>
      prev.map((report) => (report.id === reportId ? { ...report, active: !report.active } : report)),
    )
  }

  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case "Daily":
        return "bg-green-100 text-green-700"
      case "Weekly":
        return "bg-blue-100 text-blue-700"
      case "Monthly":
        return "bg-purple-100 text-purple-700"
      case "Quarterly":
        return "bg-orange-100 text-orange-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Scheduled Reports</h3>
          <p className="text-slate-600">Automate your reporting with scheduled deliveries</p>
        </div>
        <Button>
          <Clock className="h-4 w-4 mr-2" />
          New Schedule
        </Button>
      </div>

      <div className="space-y-4">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {report.name}
                    {report.active ? (
                      <Badge variant="default" className="bg-green-100 text-green-700">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Paused</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </div>
                <Switch checked={report.active} onCheckedChange={() => toggleReport(report.id)} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium">Frequency</p>
                    <Badge variant="outline" className={getFrequencyColor(report.frequency)}>
                      {report.frequency}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium">Next Run</p>
                    <p className="text-sm text-slate-600">{new Date(report.nextRun).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <div>
                    <p className="text-sm font-medium">Recipients</p>
                    <p className="text-sm text-slate-600">{report.recipients.length} people</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Email Recipients</p>
                  <p className="text-sm text-slate-600">{report.recipients.join(", ")}</p>
                </div>
                <Badge variant="outline">{report.format}</Badge>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
                <Button size="sm" variant="outline">
                  {report.active ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline">
                  Run Now
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
