"use client"

import { useMemo, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Database, Upload, FileText, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { useDatabaseOptions } from "@/lib/database-connection-options"
import { useToast } from "@/hooks/use-toast"
import type { SavedReport } from "@/models/saved-report.interface"

interface ImportReportsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Strip runtime-only / sharing fields so an imported report is created fresh and owned.
function cleanReport(report: SavedReport, connectionId: string): SavedReport {
  const rest = { ...report }
  delete rest.source
  delete rest.accessLevel
  delete rest.sharedByEmail
  delete rest.sharedByName
  return { ...rest, connectionId }
}

function isValidReport(r: unknown): r is SavedReport {
  if (!r || typeof r !== "object") return false
  const o = r as Record<string, unknown>
  return typeof o.id === "string" && typeof o.name === "string" && typeof o.sql === "string"
}

export function ImportReportsDialog({ open, onOpenChange }: ImportReportsDialogProps) {
  const { connections, reports, saveReport } = useDatabaseOptions()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedReports, setParsedReports] = useState<SavedReport[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  // reportId -> chosen connectionId, for reports whose original connection is missing
  const [orphanAssignments, setOrphanAssignments] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)

  const existingIds = useMemo(() => new Set(reports.map(r => r.id)), [reports])
  const connectionIds = useMemo(() => new Set(connections.map(c => c.id)), [connections])
  const connName = (id: string) => {
    const c = connections.find(c => c.id === id)
    return c ? (c.name || c.database) : null
  }

  // Classify parsed reports into: duplicates (already present), auto (original
  // connection exists), orphan (original connection missing — needs a choice).
  const { duplicates, autoReports, orphanReports } = useMemo(() => {
    const duplicates: SavedReport[] = []
    const autoReports: SavedReport[] = []
    const orphanReports: SavedReport[] = []
    for (const r of parsedReports) {
      if (existingIds.has(r.id)) duplicates.push(r)
      else if (connectionIds.has(r.connectionId)) autoReports.push(r)
      else orphanReports.push(r)
    }
    return { duplicates, autoReports, orphanReports }
  }, [parsedReports, existingIds, connectionIds])

  const assignedOrphanCount = orphanReports.filter(r => orphanAssignments[r.id]).length
  const willImportCount = autoReports.length + assignedOrphanCount

  const reset = () => {
    setFileName(null)
    setParsedReports([])
    setParseError(null)
    setOrphanAssignments({})
    setImporting(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting the same file
    if (!file) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string)
        // Accept: { reports: [...] } (reports export), bare [...], or
        // { savedReports: [...] } (full database export).
        const raw = Array.isArray(json) ? json : (json.reports ?? json.savedReports)
        if (!Array.isArray(raw)) {
          throw new Error("No reports found. Expected a reports export JSON file.")
        }
        const seen = new Set<string>()
        const valid: SavedReport[] = []
        for (const r of raw) {
          if (!isValidReport(r) || seen.has(r.id)) continue
          seen.add(r.id)
          valid.push(r)
        }
        if (valid.length === 0) throw new Error("No valid reports found in this file.")
        setParsedReports(valid)
        setParseError(null)
        setOrphanAssignments({})
      } catch (err) {
        setParsedReports([])
        setParseError(err instanceof Error ? err.message : "Could not read this file.")
      }
    }
    reader.onerror = () => {
      setParsedReports([])
      setParseError("Could not read this file.")
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setImporting(true)
    let imported = 0
    try {
      for (const r of autoReports) {
        await saveReport(cleanReport(r, r.connectionId))
        imported++
      }
      for (const r of orphanReports) {
        const cid = orphanAssignments[r.id]
        if (!cid) continue
        await saveReport(cleanReport(r, cid))
        imported++
      }

      const skippedDup = duplicates.length
      const skippedOrphan = orphanReports.length - assignedOrphanCount
      const extras = [
        skippedDup > 0 ? `${skippedDup} already present` : null,
        skippedOrphan > 0 ? `${skippedOrphan} without a connection` : null,
      ].filter(Boolean).join(", ")

      toast({
        title: "Reports Imported",
        description:
          `${imported} report${imported !== 1 ? "s" : ""} imported` +
          (extras ? ` · skipped ${extras}.` : "."),
      })
      handleOpenChange(false)
    } catch {
      toast({
        title: "Import Failed",
        description: "Some reports could not be imported. Please try again.",
        variant: "destructive",
      })
      setImporting(false)
    }
  }

  const hasFile = parsedReports.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Reports</DialogTitle>
          <DialogDescription>
            Load a reports export JSON file. Reports attach to their original connection when it
            exists; otherwise choose a connection for each. Reports that already exist are skipped.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFile}
          className="hidden"
        />

        {!hasFile ? (
          <div className="py-8 text-center space-y-3">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
            {parseError ? (
              <Alert variant="destructive" className="text-left">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a <code>reports-export-*.json</code> file to import.
              </p>
            )}
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground truncate">
                <FileText className="h-4 w-4 inline mr-1" />
                {fileName} · {parsedReports.length} report{parsedReports.length !== 1 ? "s" : ""}
              </span>
              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                Choose different file
              </Button>
            </div>

            <ScrollArea className="max-h-[45vh] pr-4">
              <div className="space-y-3">
                {autoReports.length > 0 && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Will import to original connection
                      <Badge variant="secondary">{autoReports.length}</Badge>
                    </div>
                    <ul className="ml-6 space-y-1 text-sm">
                      {autoReports.map(r => (
                        <li key={r.id} className="flex items-center gap-2">
                          <span className="truncate">{r.name}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {connName(r.connectionId)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {orphanReports.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Original connection not found — choose one
                      <Badge variant="secondary">{orphanReports.length}</Badge>
                    </div>
                    {connections.length === 0 ? (
                      <p className="ml-6 text-sm text-muted-foreground">
                        No connections exist yet. Create a connection first to import these.
                      </p>
                    ) : (
                      <div className="ml-6 space-y-2">
                        {orphanReports.map(r => (
                          <div key={r.id} className="flex items-center gap-2">
                            <span className="flex-1 truncate text-sm">{r.name}</span>
                            <Select
                              value={orphanAssignments[r.id] ?? ""}
                              onValueChange={(cid) =>
                                setOrphanAssignments(prev => ({ ...prev, [r.id]: cid }))
                              }
                            >
                              <SelectTrigger className="w-48 h-8 text-xs">
                                <SelectValue placeholder="Choose connection…" />
                              </SelectTrigger>
                              <SelectContent>
                                {connections.map(c => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name || c.database}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {duplicates.length > 0 && (
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      Already present — will be skipped
                      <Badge variant="outline">{duplicates.length}</Badge>
                    </div>
                    <ul className="ml-6 space-y-1 text-sm text-muted-foreground">
                      {duplicates.map(r => (
                        <li key={r.id} className="truncate">{r.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!hasFile || willImportCount === 0 || importing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {willImportCount > 0 ? `(${willImportCount})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
