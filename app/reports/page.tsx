"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus } from "lucide-react"
import { SavedReports } from "@/components/saved-reports"
import { useDatabaseOptions } from "@/lib/database-connection-options"
import { useToast } from "@/hooks/use-toast"

export default function ReportsPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const connectionInfo = useDatabaseOptions()
  const { toast } = useToast()

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Saved Reports</h1>
            <p className="text-muted-foreground">View and run your saved queries</p>
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => router.push("/query")}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Query
          </Button>
        </div>

        {/* Connection Selector */}
        {connectionInfo.connections.length > 1 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Label htmlFor="reports-connection-select" className="text-sm font-medium whitespace-nowrap">
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
                  <SelectTrigger id="reports-connection-select" className="w-full max-w-md">
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

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Saved Reports */}
        <SavedReports searchTerm={searchTerm} />
      </div>
    </div>
  )
}
