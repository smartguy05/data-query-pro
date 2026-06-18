"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  History,
  Search,
  MoreVertical,
  Play,
  Save,
  Copy,
  Trash2,
  Database,
  MessageSquareQuote,
} from "lucide-react"
import { useDatabaseOptions } from "@/lib/database-connection-options"
import { useToast } from "@/hooks/use-toast"
import { SaveReportDialog } from "@/components/save-report-dialog"
import { SavedReport, ReportParameter } from "@/models/saved-report.interface"
import type { QueryHistoryEntry } from "@/models/query-history.interface"

// Render a short relative timestamp (e.g. "3m ago", "2h ago", "Apr 3").
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return "just now"
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

const SOURCE_LABELS: Record<QueryHistoryEntry["source"], string> = {
  generated: "Generated",
  manual: "Manual",
  report: "Report",
  followup: "Follow-up",
}

export default function HistoryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const connectionInfo = useDatabaseOptions()

  const [entries, setEntries] = useState<QueryHistoryEntry[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [thisConnectionOnly, setThisConnectionOnly] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Save-as-report dialog state
  const [saveEntry, setSaveEntry] = useState<QueryHistoryEntry | null>(null)

  const loadEntries = async () => {
    const all = await connectionInfo.getQueryHistory()
    // History keeps successful queries only; filter out any legacy failed entries.
    setEntries(all.filter((e) => e.success !== false))
  }

  // Load once the context has finished initializing the storage layer.
  useEffect(() => {
    if (connectionInfo.isInitialized) {
      loadEntries()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionInfo.isInitialized])

  const currentConnectionId = connectionInfo.currentConnection?.id

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return entries.filter((e) => {
      if (thisConnectionOnly && currentConnectionId && e.connectionId !== currentConnectionId) {
        return false
      }
      if (!term) return true
      return (
        e.sql.toLowerCase().includes(term) ||
        (e.question || "").toLowerCase().includes(term) ||
        (e.connectionName || "").toLowerCase().includes(term)
      )
    })
  }, [entries, searchTerm, thisConnectionOnly, currentConnectionId])

  const handleRerun = (entry: QueryHistoryEntry) => {
    // Make the entry's connection active (if it still exists) so the query runs against
    // the right database, then reuse the query page's auto-execute URL mechanism.
    const conn = connectionInfo.connections.find((c) => c.id === entry.connectionId)
    if (conn && conn.id !== currentConnectionId) {
      connectionInfo.setCurrentConnection(conn)
    }
    router.push(`/query?sql=${encodeURIComponent(entry.sql)}&autoExecute=true`)
  }

  const handleCopy = async (entry: QueryHistoryEntry) => {
    try {
      await navigator.clipboard.writeText(entry.sql)
      toast({ title: "SQL copied", description: "Query copied to clipboard" })
    } catch {
      toast({ title: "Copy failed", description: "Could not access clipboard", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    await connectionInfo.deleteQueryHistory(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const handleClearAll = async () => {
    await connectionInfo.clearQueryHistory()
    setEntries([])
    setShowClearConfirm(false)
    toast({ title: "History cleared", description: "All query history has been removed" })
  }

  const handleSaveReport = (name: string, description: string, parameters: ReportParameter[]) => {
    if (!saveEntry) return
    const report: SavedReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      connectionId: saveEntry.connectionId,
      name,
      description,
      naturalLanguageQuery: saveEntry.question || "",
      sql: saveEntry.sql,
      explanation: "Saved from query history",
      warnings: [],
      confidence: 1,
      parameters: parameters.length > 0 ? parameters : undefined,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    }
    connectionInfo.saveReport(report)
    toast({ title: "Report Saved", description: `"${name}" has been saved successfully` })
    setSaveEntry(null)
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <History className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Query History</h1>
              <p className="text-muted-foreground">Every query you&apos;ve run, with one-click re-run</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowClearConfirm(true)}
            disabled={entries.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear History
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search SQL, question, or connection..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {currentConnectionId && (
            <div className="flex items-center gap-2">
              <Switch
                id="this-connection-only"
                checked={thisConnectionOnly}
                onCheckedChange={setThisConnectionOnly}
              />
              <Label htmlFor="this-connection-only" className="text-sm text-muted-foreground whitespace-nowrap">
                This connection only
              </Label>
            </div>
          )}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <History className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {entries.length === 0
                  ? "No queries yet. Run a query and it will show up here."
                  : "No history entries match your filters."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((entry) => (
              <Card key={entry.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      {/* Plain-English prompt leads, so you can tell at a glance what the query is */}
                      {entry.question ? (
                        <div className="flex items-start gap-2">
                          <MessageSquareQuote className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <p className="text-sm font-medium text-foreground line-clamp-2" title={entry.question}>
                            {entry.question}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">Ad-hoc SQL (no natural-language prompt)</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{SOURCE_LABELS[entry.source]}</Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Database className="h-3 w-3" />
                          {entry.connectionName || entry.connectionId}
                        </span>
                        <span className="text-xs text-muted-foreground">{relativeTime(entry.executedAt)}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.rowCount ?? 0} rows
                          {typeof entry.executionTimeMs === "number" ? ` · ${entry.executionTimeMs}ms` : ""}
                        </span>
                      </div>

                      <pre className="text-xs bg-muted rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words max-h-24">
                        {entry.sql}
                      </pre>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRerun(entry)}>
                          <Play className="h-4 w-4 mr-2" />
                          Re-run
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSaveEntry(entry)}>
                          <Save className="h-4 w-4 mr-2" />
                          Save as report
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopy(entry)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy SQL
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(entry.id)}
                          className="text-red-500 focus:text-red-500"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Save as report dialog */}
      <SaveReportDialog
        open={saveEntry !== null}
        onOpenChange={(open) => { if (!open) setSaveEntry(null) }}
        onSave={handleSaveReport}
        defaultName={saveEntry?.question?.slice(0, 60) || ""}
        sql={saveEntry?.sql}
      />

      {/* Clear-all confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all query history?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes all {entries.length} history entries from this browser. Saved reports are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-red-600 hover:bg-red-700">
              Clear History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
