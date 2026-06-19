"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
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
import { useToast } from "@/hooks/use-toast"

interface ShareDialogProps {
  resourceId: string
  resourceType: "connection" | "report"
  resourceName: string
  /** Custom trigger element. Ignored when `open`/`onOpenChange` are supplied (controlled mode). */
  trigger?: ReactNode
  /** Controlled open state. When provided, the dialog renders no internal trigger. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface SearchUser {
  id: string
  email: string
  name: string | null
}

// View/Edit only — owner shares as view and can later grant edit. (The DB also
// supports an `admin` connection permission, but we don't surface it in the UI.)
const PERMISSION_OPTIONS = [
  { value: "view", label: "View" },
  { value: "edit", label: "Edit" },
]

export function ShareDialog({
  resourceId,
  resourceType,
  resourceName,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: ShareDialogProps) {
  const { toast } = useToast()
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next)
      else setInternalOpen(next)
    },
    [isControlled, onOpenChange]
  )
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

  const handleShare = async (userId: string, perm: string = permission) => {
    try {
      const res = await fetch(`/api/sharing/${resourceType}s/${resourceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedWithId: userId, permission: perm }),
      })
      if (!res.ok) throw new Error()
      setSearchQuery("")
      setSearchResults([])
      loadShares()
      toast({ title: "Access updated", description: `Shared with ${perm} access.` })
    } catch {
      toast({
        title: "Couldn't update sharing",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRemove = async (userId: string) => {
    try {
      const res = await fetch(`/api/sharing/${resourceType}s/${resourceId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedWithId: userId }),
      })
      if (!res.ok) throw new Error()
      loadShares()
      toast({ title: "Access removed", description: "User can no longer access this." })
    } catch {
      toast({
        title: "Couldn't remove access",
        description: "Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="sm" title="Share">
              <Share2 className="h-4 w-4" />
            </Button>
          )}
        </DialogTrigger>
      )}
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
                {PERMISSION_OPTIONS.map((opt) => (
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
                      <Select
                        value={share.permission === "edit" ? "edit" : "view"}
                        onValueChange={(value) => {
                          if (value !== share.permission) {
                            handleShare(share.sharedWithId, value)
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 w-20 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERMISSION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
