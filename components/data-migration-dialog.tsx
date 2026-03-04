"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Upload, Check, AlertCircle } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

export function DataMigrationDialog() {
  const { isAuthenticated, isLoading, authEnabled } = useAuth()
  const [show, setShow] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [result, setResult] = useState<{
    connections: number
    schemas: number
    reports: number
    suggestions: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Wait for auth to finish loading
    if (isLoading) return

    // Only show if auth is enabled and user is actually logged in
    if (!authEnabled || !isAuthenticated) return

    const checkMigration = () => {
      try {
        // Check if already migrated
        if (localStorage.getItem("localDataMigrated") === "true") return

        // Check if there's local data to migrate
        const connections = JSON.parse(localStorage.getItem("databaseConnections") || "[]")
        const schemas = JSON.parse(localStorage.getItem("connectionSchemas") || "[]")
        const reports = JSON.parse(localStorage.getItem("saved_reports") || "[]")

        if (connections.length === 0 && schemas.length === 0 && reports.length === 0) {
          // No local data to migrate
          localStorage.setItem("localDataMigrated", "true")
          return
        }

        setShow(true)
      } catch {
        // Ignore errors
      }
    }

    checkMigration()
  }, [isLoading, authEnabled, isAuthenticated])

  const handleMigrate = async () => {
    setMigrating(true)
    setError(null)

    try {
      const connections = JSON.parse(localStorage.getItem("databaseConnections") || "[]")
      const schemas = JSON.parse(localStorage.getItem("connectionSchemas") || "[]")
      const reports = JSON.parse(localStorage.getItem("saved_reports") || "[]")
      const dismissed = JSON.parse(localStorage.getItem("dismissed_notifications") || "[]")

      // Collect suggestions
      const suggestions: Record<string, unknown[]> = {}
      for (const conn of connections) {
        const key = `suggestions_${conn.id}`
        const data = localStorage.getItem(key)
        if (data) {
          try {
            suggestions[conn.id] = JSON.parse(data)
          } catch {
            // Skip invalid data
          }
        }
      }

      // Get current connection ID
      let currentConnectionId = null
      try {
        const current = JSON.parse(localStorage.getItem("currentDbConnection") || "null")
        currentConnectionId = current?.id || null
      } catch {
        // Ignore
      }

      const res = await fetch("/api/data/import-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connections,
          schemas,
          reports,
          suggestions,
          currentConnectionId,
          dismissedNotifications: dismissed,
        }),
      })

      if (!res.ok) {
        throw new Error("Migration failed")
      }

      const data = await res.json()
      setResult(data.data)
      localStorage.setItem("localDataMigrated", "true")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Migration failed")
    } finally {
      setMigrating(false)
    }
  }

  const handleSkip = () => {
    localStorage.setItem("localDataMigrated", "true")
    setShow(false)
  }

  const handleClose = () => {
    setShow(false)
    // Reload to pick up migrated data from the API
    if (result) {
      window.location.reload()
    }
  }

  return (
    <Dialog open={show} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Local Data</DialogTitle>
          <DialogDescription>
            We found existing data in your browser. Would you like to import it into your account?
          </DialogDescription>
        </DialogHeader>

        {!result && !error && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your database connections, schemas, and saved reports stored in this browser
              can be imported to your account so they&apos;re available everywhere you log in.
            </p>
            <p className="text-xs text-muted-foreground">
              Your local data will not be deleted — it will only be copied to your account.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleSkip} disabled={migrating}>
                Skip
              </Button>
              <Button onClick={handleMigrate} disabled={migrating}>
                <Upload className="h-4 w-4 mr-2" />
                {migrating ? "Importing..." : "Import Data"}
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-500">
              <Check className="h-5 w-5" />
              <span className="font-medium">Import complete</span>
            </div>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>{result.connections} connection(s) imported</li>
              <li>{result.schemas} schema(s) imported</li>
              <li>{result.reports} report(s) imported</li>
              <li>{result.suggestions} suggestion cache(s) imported</li>
            </ul>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}

        {error && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Import failed</span>
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleSkip}>
                Skip
              </Button>
              <Button onClick={handleMigrate}>Retry</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
