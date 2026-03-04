"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Share2, Trash2, Search, UserPlus } from "lucide-react"
import type { ShareInfo } from "@/lib/db/repositories/sharing-repository"

interface ShareDialogProps {
  resourceId: string
  resourceType: "connection" | "report"
  resourceName: string
}

interface SearchUser {
  id: string
  email: string
  name: string | null
}

const PERMISSION_OPTIONS = {
  connection: [
    { value: "view", label: "View" },
    { value: "edit", label: "Edit" },
    { value: "admin", label: "Admin" },
  ],
  report: [
    { value: "view", label: "View" },
    { value: "edit", label: "Edit" },
  ],
}

export function ShareDialog({ resourceId, resourceType, resourceName }: ShareDialogProps) {
  const [open, setOpen] = useState(false)
  const [shares, setShares] = useState<ShareInfo[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [permission, setPermission] = useState("view")

  const loadShares = useCallback(async () => {
    try {
      const res = await fetch(`/api/sharing/${resourceType}s/${resourceId}`)
      if (res.ok) {
        const data = await res.json()
        setShares(data.data || [])
      }
    } catch {
      // Ignore errors
    }
  }, [resourceId, resourceType])

  useEffect(() => {
    if (open) {
      loadShares()
    }
  }, [open, loadShares])

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/sharing/users/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.data || [])
        }
      } catch {
        // Ignore errors
      }
      setSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleShare = async (userId: string) => {
    try {
      await fetch(`/api/sharing/${resourceType}s/${resourceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedWithId: userId, permission }),
      })
      setSearchQuery("")
      setSearchResults([])
      loadShares()
    } catch {
      // Ignore errors
    }
  }

  const handleRemove = async (userId: string) => {
    try {
      await fetch(`/api/sharing/${resourceType}s/${resourceId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedWithId: userId }),
      })
      loadShares()
    } catch {
      // Ignore errors
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Share">
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share {resourceType === "connection" ? "Connection" : "Report"}</DialogTitle>
          <DialogDescription>
            Share &quot;{resourceName}&quot; with other users
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and add */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={permission} onValueChange={setPermission}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_OPTIONS[resourceType].map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="border rounded-md max-h-40 overflow-y-auto">
              {searchResults.map((user) => (
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
                    onClick={() => handleShare(user.id)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {searching && (
            <p className="text-xs text-muted-foreground text-center">Searching...</p>
          )}

          {/* Current shares */}
          <div>
            <h4 className="text-sm font-medium mb-2">Shared with</h4>
            {shares.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not shared with anyone yet</p>
            ) : (
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-md"
                  >
                    <div>
                      <p className="text-sm font-medium">{share.name || share.email}</p>
                      {share.name && (
                        <p className="text-xs text-muted-foreground">{share.email}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded">
                        {share.permission}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(share.sharedWithId)}
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
      </DialogContent>
    </Dialog>
  )
}
