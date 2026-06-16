"use client"

import { useMemo, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Database, Download, FileText } from "lucide-react"
import { useDatabaseOptions } from "@/lib/database-connection-options"
import { useToast } from "@/hooks/use-toast"
import type { SavedReport } from "@/models/saved-report.interface"

interface ExportReportsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ConnectionGroup {
  connectionId: string
  connectionName: string
  reports: SavedReport[]
}

export function ExportReportsDialog({ open, onOpenChange }: ExportReportsDialogProps) {
  const { connections, reports } = useDatabaseOptions()
  const { toast } = useToast()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Group all reports by their connection. Reports whose connection no longer
  // exists are grouped under an "Unknown" bucket so they can still be exported.
  const groups: ConnectionGroup[] = useMemo(() => {
    const byConnection = new Map<string, SavedReport[]>()
    for (const report of reports) {
      const list = byConnection.get(report.connectionId) || []
      list.push(report)
      byConnection.set(report.connectionId, list)
    }
    return Array.from(byConnection.entries()).map(([connectionId, groupReports]) => {
      const conn = connections.find(c => c.id === connectionId)
      return {
        connectionId,
        connectionName: conn ? (conn.name || conn.database) : "Unknown connection",
        reports: groupReports,
      }
    })
  }, [reports, connections])

  // Select everything by default whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(reports.map(r => r.id)))
    }
  }, [open, reports])

  const totalCount = reports.length
  const selectedCount = selectedIds.size

  const toggleReport = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const groupState = (group: ConnectionGroup): boolean | "indeterminate" => {
    const selected = group.reports.filter(r => selectedIds.has(r.id)).length
    if (selected === 0) return false
    if (selected === group.reports.length) return true
    return "indeterminate"
  }

  const toggleGroup = (group: ConnectionGroup) => {
    const allSelected = group.reports.every(r => selectedIds.has(r.id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const r of group.reports) {
        if (allSelected) {
          next.delete(r.id)
        } else {
          next.add(r.id)
        }
      }
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(reports.map(r => r.id)))
  const selectNone = () => setSelectedIds(new Set())

  const handleExport = () => {
    const selectedReports = reports
      .filter(r => selectedIds.has(r.id))
      // Strip the runtime-only source flag; the config loader re-stamps it on import.
      .map(r => {
        const rest = { ...r }
        delete rest.source
        return rest
      })

    const payload = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      reports: selectedReports,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reports-export-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Reports Exported",
      description: `${selectedReports.length} report${selectedReports.length !== 1 ? "s" : ""} exported. Drop the file into config/reports.json to share it.`,
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Reports</DialogTitle>
          <DialogDescription>
            Choose which databases and reports to export. Selecting a database selects all of its
            reports. The downloaded file can be placed at <code>config/reports.json</code> to share
            these reports with everyone using the app.
          </DialogDescription>
        </DialogHeader>

        {totalCount === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3" />
            No reports available to export.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedCount} of {totalCount} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  Select None
                </Button>
              </div>
            </div>

            <ScrollArea className="max-h-[50vh] pr-4">
              <div className="space-y-4">
                {groups.map(group => (
                  <div key={group.connectionId} className="rounded-lg border p-3">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <Checkbox
                        checked={groupState(group)}
                        onCheckedChange={() => toggleGroup(group)}
                      />
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{group.connectionName}</span>
                      <Badge variant="secondary">{group.reports.length}</Badge>
                    </label>
                    <div className="mt-2 ml-6 space-y-1">
                      {group.reports.map(report => (
                        <label
                          key={report.id}
                          className="flex items-center gap-2 cursor-pointer text-sm py-1"
                        >
                          <Checkbox
                            checked={selectedIds.has(report.id)}
                            onCheckedChange={() => toggleReport(report.id)}
                          />
                          <span className="truncate">{report.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedCount === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export {selectedCount > 0 ? `(${selectedCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
