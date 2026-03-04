"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useDatabaseOptions } from "@/lib/database-connection-options"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Shield, Database, UserPlus, Trash2, Search, Users, Plus, Pencil, CheckCircle2, XCircle, Loader2 } from "lucide-react"

interface ServerConnection {
  id: string
  name: string
  type: string
  host?: string
  port?: string
  database?: string
  description?: string
}

interface Assignment {
  id: string
  assignedTo: string
  assignedType: "user" | "group"
  email?: string
  name?: string
}

interface SearchUser {
  id: string
  email: string
  name: string | null
}

interface ConnectionFormData {
  name: string
  type: string
  host: string
  port: string
  database: string
  username: string
  password: string
  description: string
}

const DEFAULT_FORM: ConnectionFormData = {
  name: "",
  type: "postgresql",
  host: "",
  port: "5432",
  database: "",
  username: "",
  password: "",
  description: "",
}

const DEFAULT_PORTS: Record<string, string> = {
  postgresql: "5432",
  mysql: "3306",
  sqlserver: "1433",
  sqlite: "",
}

export default function AdminPage() {
  const { isAdmin, authEnabled, isLoading } = useAuth()
  const { refreshConnections, setCurrentConnection } = useDatabaseOptions()
  const router = useRouter()
  const [connections, setConnections] = useState<ServerConnection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [assignType, setAssignType] = useState<"user" | "group">("user")
  const [groupName, setGroupName] = useState("")

  // Connection CRUD state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ConnectionFormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [testMessage, setTestMessage] = useState("")
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [loadingConnections, setLoadingConnections] = useState(true)

  useEffect(() => {
    if (!isLoading && (!authEnabled || !isAdmin)) {
      router.replace("/")
    }
  }, [isLoading, authEnabled, isAdmin, router])

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/server-connections")
      if (res.ok) {
        const data = await res.json()
        setConnections(data.data || [])
      }
    } catch {
      // Ignore
    } finally {
      setLoadingConnections(false)
    }
  }, [])

  useEffect(() => {
    if (authEnabled && isAdmin) {
      loadConnections()
    }
  }, [authEnabled, isAdmin, loadConnections])

  const loadAssignments = useCallback(async (connId: string) => {
    try {
      const res = await fetch(`/api/admin/server-connections/${connId}/assignments`)
      if (res.ok) {
        const data = await res.json()
        setAssignments(data.data || [])
      }
    } catch {
      // Ignore
    }
  }, [])

  useEffect(() => {
    if (selectedConnection) {
      loadAssignments(selectedConnection)
    }
  }, [selectedConnection, loadAssignments])

  useEffect(() => {
    if (searchQuery.length < 2 || assignType !== "user") {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sharing/users/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.data || [])
        }
      } catch {
        // Ignore
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, assignType])

  const handleAssignUser = async (userId: string) => {
    if (!selectedConnection) return
    try {
      await fetch(`/api/admin/server-connections/${selectedConnection}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: userId, assignedType: "user" }),
      })
      setSearchQuery("")
      setSearchResults([])
      loadAssignments(selectedConnection)
    } catch {
      // Ignore
    }
  }

  const handleAssignGroup = async () => {
    if (!selectedConnection || !groupName.trim()) return
    try {
      await fetch(`/api/admin/server-connections/${selectedConnection}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: groupName.trim(), assignedType: "group" }),
      })
      setGroupName("")
      loadAssignments(selectedConnection)
    } catch {
      // Ignore
    }
  }

  const handleRemoveAssignment = async (assignedTo: string, assignedType: string) => {
    if (!selectedConnection) return
    try {
      await fetch(`/api/admin/server-connections/${selectedConnection}/assign`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo, assignedType }),
      })
      loadAssignments(selectedConnection)
    } catch {
      // Ignore
    }
  }

  // --- Connection CRUD handlers ---

  const openCreateDialog = () => {
    setEditingId(null)
    setForm(DEFAULT_FORM)
    setTestStatus("idle")
    setTestMessage("")
    setDialogOpen(true)
  }

  const openEditDialog = (conn: ServerConnection) => {
    setEditingId(conn.id)
    setForm({
      name: conn.name,
      type: conn.type,
      host: conn.host || "",
      port: conn.port || DEFAULT_PORTS[conn.type] || "",
      database: conn.database || "",
      username: "",
      password: "",
      description: conn.description || "",
    })
    setTestStatus("idle")
    setTestMessage("")
    setDialogOpen(true)
  }

  const handleTypeChange = (type: string) => {
    setForm(prev => ({
      ...prev,
      type,
      port: DEFAULT_PORTS[type] || prev.port,
    }))
  }

  const handleTestConnection = async () => {
    setTestStatus("testing")
    setTestMessage("")
    try {
      const res = await fetch("/api/connection/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection: {
            type: form.type,
            host: form.host,
            port: form.port,
            database: form.database,
            username: form.username,
            password: form.password,
          },
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setTestStatus("success")
        setTestMessage(`Connected (${data.latency || "?"}ms)`)
      } else {
        setTestStatus("error")
        setTestMessage(data.error || "Connection failed")
      }
    } catch {
      setTestStatus("error")
      setTestMessage("Connection test failed")
    }
  }

  const handleSaveConnection = async () => {
    if (!form.name || !form.type) return
    setSaving(true)
    try {
      if (editingId) {
        // Update
        const res = await fetch(`/api/admin/server-connections/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (res.ok) {
          setDialogOpen(false)
          loadConnections()
          refreshConnections()
        }
      } else {
        // Create
        const res = await fetch("/api/admin/server-connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        if (res.ok) {
          const data = await res.json()
          setDialogOpen(false)
          loadConnections()
          await refreshConnections()
          // Set the new connection as active and navigate to schema for introspection
          if (data.data) {
            setCurrentConnection(data.data)
            router.push("/schema")
          }
        }
      }
    } catch {
      // Ignore
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConnection = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/server-connections/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setDeleteConfirmId(null)
        if (selectedConnection === id) {
          setSelectedConnection(null)
          setAssignments([])
        }
        loadConnections()
        refreshConnections()
      }
    } catch {
      // Ignore
    }
  }

  if (isLoading || !authEnabled || !isAdmin) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
          <Shield className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage server connections and assignments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connection list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Server Connections
            </h2>
            <Button variant="outline" size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </div>
          {loadingConnections ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading connections...</p>
            </div>
          ) : connections.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No server connections configured. Click &quot;New&quot; to add one.
            </p>
          ) : (
            connections.map(conn => (
              <div
                key={conn.id}
                className={`relative group w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedConnection === conn.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => setSelectedConnection(conn.id)}
              >
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm truncate">{conn.name}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">{conn.type}</span>
                  {conn.host && (
                    <span className="text-xs text-muted-foreground truncate ml-2">{conn.host}</span>
                  )}
                </div>
                {/* Edit/Delete buttons on hover */}
                <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => { e.stopPropagation(); openEditDialog(conn) }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(conn.id) }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Assignment management */}
        <div className="md:col-span-2">
          {selectedConnection ? (
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Assignments for: {connections.find(c => c.id === selectedConnection)?.name}
              </h2>

              {/* Assign controls */}
              <div className="flex gap-2 items-center">
                <Select value={assignType} onValueChange={(v) => setAssignType(v as "user" | "group")}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>

                {assignType === "user" ? (
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users by email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 gap-2">
                    <Input
                      placeholder="Authentik group name..."
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                    <Button onClick={handleAssignGroup} size="sm">
                      <UserPlus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                )}
              </div>

              {/* User search results */}
              {assignType === "user" && searchResults.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {searchResults.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-muted/50"
                    >
                      <div>
                        <p className="text-sm font-medium">{user.name || user.email}</p>
                        {user.name && (
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAssignUser(user.id)}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Current assignments */}
              <div>
                <h3 className="text-sm font-medium mb-2">Current Assignments</h3>
                {assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No assignments yet. All users can access when no assignments are configured.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {assignments.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-md"
                      >
                        <div className="flex items-center gap-2">
                          {a.assignedType === "group" ? (
                            <Users className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">
                              {(a.name || a.email || a.assignedTo)[0]?.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {a.assignedType === "group"
                                ? a.assignedTo
                                : a.name || a.email || a.assignedTo}
                            </p>
                            {a.assignedType === "user" && a.email && (
                              <p className="text-xs text-muted-foreground">{a.email}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">
                            {a.assignedType}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAssignment(a.assignedTo, a.assignedType)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <p>Select a server connection to manage assignments</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Server Connection" : "New Server Connection"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the server connection details. Leave username/password blank to keep existing values."
                : "Create a new server connection that can be assigned to users and groups."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="conn-name">Name</Label>
                <Input
                  id="conn-name"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Production DB"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conn-type">Type</Label>
                <Select value={form.type} onValueChange={handleTypeChange}>
                  <SelectTrigger id="conn-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgresql">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="sqlserver">SQL Server</SelectItem>
                    <SelectItem value="sqlite">SQLite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="conn-host">Host</Label>
                <Input
                  id="conn-host"
                  value={form.host}
                  onChange={(e) => setForm(f => ({ ...f, host: e.target.value }))}
                  placeholder="localhost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conn-port">Port</Label>
                <Input
                  id="conn-port"
                  value={form.port}
                  onChange={(e) => setForm(f => ({ ...f, port: e.target.value }))}
                  placeholder="5432"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conn-database">Database</Label>
              <Input
                id="conn-database"
                value={form.database}
                onChange={(e) => setForm(f => ({ ...f, database: e.target.value }))}
                placeholder="mydb"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="conn-username">Username</Label>
                <Input
                  id="conn-username"
                  value={form.username}
                  onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder={editingId ? "(unchanged)" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conn-password">Password</Label>
                <Input
                  id="conn-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder={editingId ? "(unchanged)" : ""}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conn-description">Description (optional)</Label>
              <Input
                id="conn-description"
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of the database"
              />
            </div>

            {/* Test connection status */}
            {testStatus !== "idle" && (
              <div className={`flex items-center gap-2 text-sm rounded-md px-3 py-2 ${
                testStatus === "testing" ? "bg-muted text-muted-foreground" :
                testStatus === "success" ? "bg-green-500/10 text-green-700 dark:text-green-400" :
                "bg-red-500/10 text-red-700 dark:text-red-400"
              }`}>
                {testStatus === "testing" && <Loader2 className="h-4 w-4 animate-spin" />}
                {testStatus === "success" && <CheckCircle2 className="h-4 w-4" />}
                {testStatus === "error" && <XCircle className="h-4 w-4" />}
                <span>{testStatus === "testing" ? "Testing connection..." : testMessage}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleTestConnection} disabled={saving || testStatus === "testing"}>
              {testStatus === "testing" ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Testing...</>
              ) : (
                "Test Connection"
              )}
            </Button>
            <Button onClick={handleSaveConnection} disabled={saving || !form.name}>
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</>
              ) : editingId ? (
                "Save Changes"
              ) : (
                "Create Connection"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Server Connection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{connections.find(c => c.id === deleteConfirmId)?.name}&quot;?
              This will also remove all user/group assignments. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDeleteConnection(deleteConfirmId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
