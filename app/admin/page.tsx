"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Shield, Database, UserPlus, Trash2, Search, Users } from "lucide-react"

interface ServerConnection {
  id: string
  name: string
  type: string
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

export default function AdminPage() {
  const { isAdmin, authEnabled, isLoading } = useAuth()
  const router = useRouter()
  const [connections, setConnections] = useState<ServerConnection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [assignType, setAssignType] = useState<"user" | "group">("user")
  const [groupName, setGroupName] = useState("")

  useEffect(() => {
    if (!isLoading && (!authEnabled || !isAdmin)) {
      router.replace("/")
    }
  }, [isLoading, authEnabled, isAdmin, router])

  useEffect(() => {
    if (authEnabled && isAdmin) {
      fetch("/api/admin/server-connections")
        .then(res => res.json())
        .then(data => setConnections(data.data || []))
        .catch(() => {})
    }
  }, [authEnabled, isAdmin])

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
          <p className="text-sm text-muted-foreground">Manage server connection assignments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connection list */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Server Connections
          </h2>
          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No server connections configured. Add connections to config/databases.json.
            </p>
          ) : (
            connections.map(conn => (
              <button
                key={conn.id}
                onClick={() => setSelectedConnection(conn.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedConnection === conn.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{conn.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{conn.type}</span>
              </button>
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
    </div>
  )
}
