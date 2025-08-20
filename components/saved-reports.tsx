"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Calendar, Download, Share2, Edit, Trash2, MoreHorizontal, Eye } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SavedReportsProps {
  searchTerm: string
}

const mockReports = [
  {
    id: 1,
    name: "Monthly Sales Report",
    description: "Comprehensive sales analysis for executive review",
    lastRun: "2024-01-15",
    category: "Sales",
    shared: true,
    scheduled: true,
  },
  {
    id: 2,
    name: "Customer Acquisition Analysis",
    description: "New customer trends and acquisition costs",
    lastRun: "2024-01-14",
    category: "Marketing",
    shared: false,
    scheduled: false,
  },
  {
    id: 3,
    name: "Inventory Status Report",
    description: "Current stock levels and reorder recommendations",
    lastRun: "2024-01-13",
    category: "Operations",
    shared: true,
    scheduled: true,
  },
  {
    id: 4,
    name: "Financial Performance Dashboard",
    description: "Key financial metrics and KPIs",
    lastRun: "2024-01-12",
    category: "Finance",
    shared: true,
    scheduled: false,
  },
]

export function SavedReports({ searchTerm }: SavedReportsProps) {
  const [reports] = useState(mockReports)

  const filteredReports = reports.filter(
    (report) =>
      report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.category.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const exportReport = async (reportId: number, format: string) => {
    // Mock export functionality
    console.log(`Exporting report ${reportId} as ${format}`)

    // Simulate export delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Create mock file download
    const fileName = `report-${reportId}.${format.toLowerCase()}`
    const blob = new Blob([`Mock ${format} export for report ${reportId}`], {
      type: format === "PDF" ? "application/pdf" : "application/vnd.ms-excel",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {filteredReports.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No reports found</h3>
            <p className="text-slate-600">Try adjusting your search or create a new report.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{report.name}</CardTitle>
                    <CardDescription className="text-sm">{report.description}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        View Report
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => exportReport(report.id, "PDF")}>
                        <Download className="h-4 w-4 mr-2" />
                        Export as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportReport(report.id, "Excel")}>
                        <Download className="h-4 w-4 mr-2" />
                        Export as Excel
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{report.category}</Badge>
                  {report.shared && <Badge variant="secondary">Shared</Badge>}
                  {report.scheduled && <Badge variant="default">Scheduled</Badge>}
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="h-4 w-4" />
                  Last run: {new Date(report.lastRun).toLocaleDateString()}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="flex-1">
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
