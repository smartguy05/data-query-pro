"use client"

import { SchemaExplorer } from "@/components/schema-explorer"
import { useDatabaseOptions } from "@/lib/database-connection-options"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

export default function SchemaPage() {
  const connectionInformation = useDatabaseOptions()
  const { toast } = useToast()

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Database Schema</h1>
            <p className="text-muted-foreground">
              Explore your database structure and add AI-generated descriptions to improve query accuracy
            </p>
          </div>

          {/* Connection Selector */}
          {connectionInformation.connections.length > 1 && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Label htmlFor="schema-connection-select" className="text-sm font-medium whitespace-nowrap">
                    Active Connection:
                  </Label>
                  <Select
                    value={connectionInformation.currentConnection?.id || ""}
                    onValueChange={(connectionId) => {
                      const connection = connectionInformation.connections.find(c => c.id === connectionId)
                      if (connection) {
                        connectionInformation.setCurrentConnection(connection)
                        toast({
                          title: "Connection Changed",
                          description: `Switched to ${connection.name || connection.database}`,
                        })
                      }
                    }}
                  >
                    <SelectTrigger id="schema-connection-select" className="w-full max-w-md">
                      <SelectValue placeholder="Select a database connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {connectionInformation.connections.map((conn) => (
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

          <SchemaExplorer />
        </div>
      </div>
      <Toaster />
    </div>
  )
}
