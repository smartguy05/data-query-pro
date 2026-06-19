"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  GraduationCap,
  Search,
  Pencil,
  Trash2,
  Database,
  User as UserIcon,
  AlertTriangle,
  MessageSquareQuote,
} from "lucide-react"
import { useDatabaseOptions } from "@/lib/database-connection-options"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { computeSchemaFingerprint } from "@/utils/schema-fingerprint"
import type { QueryCorrection } from "@/models/query-correction.interface"

function relativeTime(iso?: string): string {
  if (!iso) return ""
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return "just now"
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function LearningPage() {
  const { toast } = useToast()
  const connectionInfo = useDatabaseOptions()
  const { user, isAdmin, authEnabled } = useAuth()

  const [corrections, setCorrections] = useState<QueryCorrection[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)

  // Edit dialog state
  const [editing, setEditing] = useState<QueryCorrection | null>(null)
  const [editQuestion, setEditQuestion] = useState("")
  const [editError, setEditError] = useState("")
  const [editGoodSql, setEditGoodSql] = useState("")
  const [saving, setSaving] = useState(false)

  // Delete confirmation state
  const [deleting, setDeleting] = useState<QueryCorrection | null>(null)

  const currentSchema = connectionInfo.currentSchema
  const fingerprint = useMemo(
    () => computeSchemaFingerprint(currentSchema),
    [currentSchema]
  )
  const connectionName = connectionInfo.currentConnection?.name

  const load = useCallback(async () => {
    if (!fingerprint) {
      setCorrections([])
      return
    }
    setLoading(true)
    try {
      const list = await connectionInfo.getCorrectionsForFingerprint(fingerprint)
      setCorrections(list)
    } catch {
      setCorrections([])
    } finally {
      setLoading(false)
    }
  }, [fingerprint, connectionInfo])

  useEffect(() => {
    if (connectionInfo.isInitialized) {
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionInfo.isInitialized, fingerprint])

  // A correction can be edited/deleted by its author or an admin. With auth disabled,
  // everything is device-local and freely editable.
  const canManage = useCallback(
    (c: QueryCorrection): boolean => {
      if (!authEnabled) return true
      if (isAdmin) return true
      return !!user?.id && c.ownerId === user.id
    },
    [authEnabled, isAdmin, user?.id]
  )

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return corrections
    return corrections.filter(
      (c) =>
        (c.question || "").toLowerCase().includes(term) ||
        c.badSql.toLowerCase().includes(term) ||
        c.goodSql.toLowerCase().includes(term) ||
        c.error.toLowerCase().includes(term)
    )
  }, [corrections, searchTerm])

  const openEdit = (c: QueryCorrection) => {
    setEditing(c)
    setEditQuestion(c.question || "")
    setEditError(c.error)
    setEditGoodSql(c.goodSql)
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const patch = { question: editQuestion, error: editError, goodSql: editGoodSql }
      await connectionInfo.updateQueryCorrection(editing.id, patch)
      setCorrections((prev) =>
        prev.map((c) => (c.id === editing.id ? { ...c, ...patch } : c))
      )
      toast({ title: "Correction updated", description: "Future queries for this schema will use it." })
      setEditing(null)
    } catch {
      toast({ title: "Update failed", description: "Could not save the correction.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleting) return
    try {
      await connectionInfo.deleteQueryCorrection(deleting.id)
      setCorrections((prev) => prev.filter((c) => c.id !== deleting.id))
      toast({ title: "Correction deleted" })
    } catch {
      toast({ title: "Delete failed", description: "Could not delete the correction.", variant: "destructive" })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <GraduationCap className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Learned Corrections</h1>
              <p className="text-muted-foreground">
                Failed&rarr;fixed queries the AI learns from{authEnabled ? ", shared across your team" : ""}.
                {connectionName ? ` Showing corrections for ${connectionName}'s schema.` : ""}
              </p>
            </div>
          </div>

          {/* Connection Selector */}
          {connectionInfo.connections.length > 1 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Label htmlFor="learning-connection-select" className="text-sm font-medium whitespace-nowrap">
                    Active Connection:
                  </Label>
                  <Select
                    value={connectionInfo.currentConnection?.id || ""}
                    onValueChange={(connectionId) => {
                      const connection = connectionInfo.connections.find(c => c.id === connectionId)
                      if (connection) {
                        connectionInfo.setCurrentConnection(connection)
                        toast({
                          title: "Connection Changed",
                          description: `Switched to ${connection.name || connection.database}`,
                        })
                      }
                    }}
                  >
                    <SelectTrigger id="learning-connection-select" className="w-full max-w-md">
                      <SelectValue placeholder="Select a database connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {connectionInfo.connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          {conn.name || conn.database} ({conn.host})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No schema → nothing to key corrections against */}
          {!fingerprint ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Database className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Select a connection and load its schema to see learned corrections.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search question, SQL, or error..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* List */}
              {filtered.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      {loading
                        ? "Loading..."
                        : corrections.length === 0
                          ? "No corrections learned yet. When you revise a failed query, the fix is recorded here."
                          : "No corrections match your search."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filtered.map((c) => {
                    const manageable = canManage(c)
                    return (
                      <Card key={c.id} className="overflow-hidden">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              {c.question ? (
                                <div className="flex items-start gap-2">
                                  <MessageSquareQuote className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                                  <p className="text-sm font-medium text-foreground" title={c.question}>
                                    {c.question}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm italic text-muted-foreground">No natural-language prompt</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(c)}
                                disabled={!manageable}
                                title={manageable ? "Edit" : "Only the author or an admin can edit this"}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleting(c)}
                                disabled={!manageable}
                                title={manageable ? "Delete" : "Only the author or an admin can delete this"}
                                className={manageable ? "text-red-500 hover:text-red-500" : ""}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-2">
                            {c.databaseType && <Badge variant="secondary">{c.databaseType}</Badge>}
                            {authEnabled && c.ownerName && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <UserIcon className="h-3 w-3" />
                                {c.ownerName}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">{relativeTime(c.updatedAt || c.createdAt)}</span>
                          </div>

                          {/* The failure */}
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-red-500 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Failed query
                            </p>
                            <pre className="text-xs bg-muted rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words max-h-24">
                              {c.badSql}
                            </pre>
                            <p className="text-xs text-muted-foreground break-words">{c.error}</p>
                          </div>

                          {/* The fix */}
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-green-600 dark:text-green-500">Corrected query</p>
                            <pre className="text-xs bg-muted rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-words max-h-24">
                              {c.goodSql}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Edit dialog */}
        <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null) }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit correction</DialogTitle>
              <DialogDescription>
                Refine what the AI learns from this failed&rarr;fixed pair. Changes apply to future query generation for this schema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-question">Question</Label>
                <Input
                  id="edit-question"
                  value={editQuestion}
                  onChange={(e) => setEditQuestion(e.target.value)}
                  placeholder="Natural-language question (optional)"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-error">Error message</Label>
                <Textarea
                  id="edit-error"
                  value={editError}
                  onChange={(e) => setEditError(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-good-sql">Corrected SQL</Label>
                <Textarea
                  id="edit-good-sql"
                  value={editGoodSql}
                  onChange={(e) => setEditGoodSql(e.target.value)}
                  rows={5}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving || !editGoodSql.trim()}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this correction?</AlertDialogTitle>
              <AlertDialogDescription>
                {authEnabled
                  ? "This removes it from the shared pool for everyone querying this schema. This cannot be undone."
                  : "This removes it from this device. This cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  )
}

