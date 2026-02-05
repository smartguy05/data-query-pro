"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Calendar, Trash2, MoreHorizontal, Eye, AlertTriangle, Play, Edit, Copy, Star, Database } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SavedReport } from "@/models/saved-report.interface"
import { useDatabaseOptions } from "@/lib/database-connection-options"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ParameterInputDialog } from "./parameter-input-dialog"
import { EditReportDialog } from "./edit-report-dialog"

interface SavedReportsProps {
  searchTerm: string
}

export function SavedReports({ searchTerm }: SavedReportsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const connectionInfo = useDatabaseOptions()
  const [reports, setReports] = useState<SavedReport[]>([])
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showParameterDialog, setShowParameterDialog] = useState(false)
  const [reportToRun, setReportToRun] = useState<SavedReport | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [reportToEdit, setReportToEdit] = useState<SavedReport | null>(null)
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [reportToClone, setReportToClone] = useState<SavedReport | null>(null)
  const [cloneName, setCloneName] = useState("")

  useEffect(() => {
    // Wait for context to be initialized before loading reports
    // This ensures server-config reports are written to localStorage first
    if (connectionInfo.isInitialized) {
      loadReports()
    }
  }, [connectionInfo.isInitialized, connectionInfo.currentConnection?.id])

  // Handle dialog close focus management using Radix UI's built-in mechanisms
  // instead of manual DOM manipulation. The onOpenChange handlers below
  // ensure proper cleanup when dialogs close.
  const handleEditDialogClose = useCallback((open: boolean) => {
    setShowEditDialog(open)
    if (!open) {
      setReportToEdit(null)
    }
  }, [])

  const handleCloneDialogClose = useCallback((open: boolean) => {
    setShowCloneDialog(open)
    if (!open) {
      setReportToClone(null)
      setCloneName("")
    }
  }, [])

  const loadReports = () => {
    const savedReports = JSON.parse(localStorage.getItem("saved_reports") || "[]") as SavedReport[]

    // Filter by current connection if one is active
    const activeConnection = connectionInfo.getConnection()
    if (activeConnection) {
      setReports(savedReports.filter(r => r.connectionId === activeConnection.id))
    } else {
      setReports(savedReports)
    }
  }

  const filteredReports = reports.filter(
    (report) =>
      report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (report.description?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      report.naturalLanguageQuery.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const deleteReport = (reportId: string) => {
    const savedReports = JSON.parse(localStorage.getItem("saved_reports") || "[]") as SavedReport[]
    const updatedReports = savedReports.filter(r => r.id !== reportId)
    localStorage.setItem("saved_reports", JSON.stringify(updatedReports))
    loadReports()

    toast({
      title: "Report Deleted",
      description: "The report has been removed",
    })
  }

  const toggleFavorite = (reportId: string) => {
    const savedReports = JSON.parse(localStorage.getItem("saved_reports") || "[]") as SavedReport[]
    const updatedReports = savedReports.map(r =>
      r.id === reportId ? { ...r, isFavorite: !r.isFavorite } : r
    )
    localStorage.setItem("saved_reports", JSON.stringify(updatedReports))
    loadReports()

    const report = updatedReports.find(r => r.id === reportId)
    toast({
      title: report?.isFavorite ? "Added to Favorites" : "Removed from Favorites",
      description: report?.isFavorite ? "This report is now a favorite" : "This report is no longer a favorite",
    })
  }

  const viewReport = (report: SavedReport) => {
    setSelectedReport(report)
    setShowDetailDialog(true)
  }

  const editReport = (report: SavedReport) => {
    // Small delay to ensure dropdown closes and loses focus
    setTimeout(() => {
      setReportToEdit(report)
      setShowEditDialog(true)
    }, 50)
  }

  const cloneReport = (report: SavedReport) => {
    // Small delay to ensure dropdown closes and loses focus
    setTimeout(() => {
      setReportToClone(report)
      setCloneName(`${report.name} (Copy)`)
      setShowCloneDialog(true)
    }, 50)
  }

  const confirmClone = () => {
    if (!reportToClone || !cloneName.trim()) return

    const clonedReport: SavedReport = {
      ...reportToClone,
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: cloneName.trim(),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      lastRun: undefined, // Reset last run time
    }

    // Save to localStorage
    const savedReports = JSON.parse(localStorage.getItem("saved_reports") || "[]") as SavedReport[]
    savedReports.push(clonedReport)
    localStorage.setItem("saved_reports", JSON.stringify(savedReports))
    loadReports()

    // Close clone dialog properly
    handleCloneDialogClose(false)

    toast({
      title: "Report Cloned",
      description: `"${cloneName.trim()}" has been created`,
    })

    // Open in edit mode after a small delay
    setTimeout(() => {
      setReportToEdit(clonedReport)
      setShowEditDialog(true)
    }, 300)
  }

  const saveEditedReport = (updatedReport: SavedReport) => {
    const savedReports = JSON.parse(localStorage.getItem("saved_reports") || "[]") as SavedReport[]
    const updatedReports = savedReports.map(r => r.id === updatedReport.id ? updatedReport : r)
    localStorage.setItem("saved_reports", JSON.stringify(updatedReports))
    loadReports()

    toast({
      title: "Report Updated",
      description: "Your changes have been saved",
    })
  }

  const runReport = (report: SavedReport) => {
    // Check if report has parameters
    if (report.parameters && report.parameters.length > 0) {
      setReportToRun(report)
      setShowParameterDialog(true)
    } else {
      executeReport(report, {})
    }
  }

  const executeReport = (report: SavedReport, paramValues: Record<string, any>) => {
    // Switch to the report's saved connection before executing
    const reportConnection = connectionInfo.connections.find(c => c.id === report.connectionId)
    if (!reportConnection) {
      toast({
        title: "Connection Not Found",
        description: `The database connection for this report (${report.connectionId}) no longer exists.`,
        variant: "destructive",
      })
      return
    }

    // Switch to the report's connection
    if (connectionInfo.currentConnection?.id !== report.connectionId) {
      connectionInfo.setCurrentConnection(reportConnection)
      toast({
        title: "Connection Switched",
        description: `Switched to ${reportConnection.name || reportConnection.database} for this report`,
      })
    }

    // Substitute parameter values in SQL
    let finalSql = report.sql
    if (report.parameters) {
      report.parameters.forEach(param => {
        const value = paramValues[param.name] || param.defaultValue || ''
        // Replace {{parameter_name}} with the actual value
        // Add quotes around text values, but not for numbers or booleans
        let formattedValue = value
        if (param.type === 'text' || param.type === 'date' || param.type === 'datetime') {
          formattedValue = `'${value}'`
        }
        finalSql = finalSql.replace(new RegExp(`\\{\\{${param.name}\\}\\}`, 'g'), formattedValue)
      })
    }

    // Update last run time
    const savedReports = JSON.parse(localStorage.getItem("saved_reports") || "[]") as SavedReport[]
    const updatedReports = savedReports.map(r =>
      r.id === report.id
        ? { ...r, lastRun: new Date().toISOString() }
        : r
    )
    localStorage.setItem("saved_reports", JSON.stringify(updatedReports))
    loadReports()

    // Navigate to query page with the parameterized query
    // We'll pass the SQL directly since it's already been parameterized
    const params = new URLSearchParams({
      suggestion: encodeURIComponent(report.naturalLanguageQuery),
      sql: encodeURIComponent(finalSql),
      autoExecute: 'true'
    })
    router.push(`/query?${params.toString()}`)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never"
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  return (
    <div>
      <div className="space-y-4">
        {filteredReports.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No reports found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm
                  ? "Try adjusting your search or create a new report."
                  : "Save queries from the Query page to see them here."}
              </p>
              <Button onClick={() => router.push("/query")} className="bg-blue-600 hover:bg-blue-700">
                Go to Query Page
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReports.map((report) => (
              <Card key={report.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{report.name}</CardTitle>
                      <CardDescription className="text-sm line-clamp-2">
                        {report.description || report.naturalLanguageQuery}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFavorite(report.id)}
                        className="hover:bg-transparent"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            report.isFavorite
                              ? "fill-amber-500 text-amber-500"
                              : "text-muted-foreground"
                          }`}
                        />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => viewReport(report)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => runReport(report)}>
                            <Play className="h-4 w-4 mr-2" />
                            Run Query
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => editReport(report)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Report
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => cloneReport(report)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Clone Report
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => deleteReport(report.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={report.confidence > 0.8 ? "default" : "secondary"}>
                      {Math.round(report.confidence * 100)}% Confidence
                    </Badge>
                    {report.warnings.length > 0 && (
                      <Badge variant="destructive">
                        {report.warnings.length} Warning{report.warnings.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    <Badge variant="outline" className="gap-1">
                      <Database className="h-3 w-3" />
                      {(() => {
                        const conn = connectionInfo.connections.find(c => c.id === report.connectionId)
                        return conn ? (conn.name || conn.database) : "Unknown"
                      })()}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Created: {formatDate(report.createdAt)}
                    </div>
                    {report.lastRun && (
                      <div className="flex items-center gap-2">
                        <Play className="h-3 w-3" />
                        Last run: {formatDate(report.lastRun)}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={() => runReport(report)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Run
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => viewReport(report)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Report Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedReport && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedReport.name}</DialogTitle>
                <DialogDescription>
                  {selectedReport.description || "Saved query report"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Original Question</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {selectedReport.naturalLanguageQuery}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">AI Explanation</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {selectedReport.explanation}
                  </p>
                </div>

                {selectedReport.warnings.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Warnings:</strong>
                      <ul className="mt-1 list-disc list-inside">
                        {selectedReport.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div>
                  <h4 className="text-sm font-semibold mb-2">SQL Query</h4>
                  <div className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{selectedReport.sql}</pre>
                  </div>
                </div>

                {selectedReport.parameters && selectedReport.parameters.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Parameters</h4>
                    <div className="bg-muted p-3 rounded-lg">
                      <ul className="text-sm space-y-1">
                        {selectedReport.parameters.map(param => (
                          <li key={param.name}>
                            <code className="bg-background px-1 py-0.5 rounded">
                              {`{{${param.name}}}`}
                            </code>
                            {' - '}{param.label} ({param.type})
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div>
                    <Badge variant={selectedReport.confidence > 0.8 ? "default" : "secondary"}>
                      {Math.round(selectedReport.confidence * 100)}% Confidence
                    </Badge>
                  </div>
                  <div>
                    Created: {formatDate(selectedReport.createdAt)}
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                    Close
                  </Button>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      setShowDetailDialog(false)
                      runReport(selectedReport)
                    }}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Run This Query
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Parameter Input Dialog */}
      {reportToRun && reportToRun.parameters && (
        <ParameterInputDialog
          open={showParameterDialog}
          onOpenChange={setShowParameterDialog}
          parameters={reportToRun.parameters}
          onRun={(values) => executeReport(reportToRun, values)}
          reportName={reportToRun.name}
        />
      )}

      {/* Edit Report Dialog */}
      {reportToEdit && (
        <EditReportDialog
          key={reportToEdit.id}
          open={showEditDialog}
          onOpenChange={handleEditDialogClose}
          report={reportToEdit}
          onSave={saveEditedReport}
        />
      )}

      {/* Clone Report Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={handleCloneDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Report</DialogTitle>
            <DialogDescription>
              Enter a name for the cloned report. It will open in edit mode after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clone-name">Report Name</Label>
              <Input
                id="clone-name"
                placeholder="Enter report name"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && cloneName.trim()) {
                    confirmClone()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleCloneDialogClose(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmClone}
              disabled={!cloneName.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Clone & Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
