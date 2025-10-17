"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Play, Database, AlertTriangle, Save } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { QueryResultsDisplay } from "@/components/query-results-display"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {useDatabaseOptions} from "@/lib/database-connection-options"
import { SaveReportDialog } from "@/components/save-report-dialog"
import { AIOperationBanner } from "@/components/ai-operation-banner"
import { SavedReport, ReportParameter } from "@/models/saved-report.interface"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
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
import { storage, StorageKeys } from "@/lib/storage"

interface QueryResult {
  sql: string
  explanation: string
  confidence: number
  warnings: string[]
}

export default function QueryPage() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [naturalQuery, setNaturalQuery] = useState("")
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [editableSql, setEditableSql] = useState("");
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionResults, setExecutionResults] = useState<any>(null)
  const [error, setError] = useState("")
  const [relevantTables, setRelevantTables] = useState<string[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showClearConfirmation, setShowClearConfirmation] = useState(false)

  useEffect(() => {
    const queryParam = searchParams.get("suggestion")
    const descriptionParam = searchParams.get("description")

    if (queryParam) {
      // If both description and query are provided, combine them for better context
      if (descriptionParam) {
        const description = decodeURIComponent(descriptionParam)
        const query = decodeURIComponent(queryParam)
        setNaturalQuery(`Goal: ${description}\n\nQuery: ${query}`)
      } else {
        setNaturalQuery(decodeURIComponent(queryParam))
      }
    }

    const tablesParam = searchParams.get("tables")
    if (tablesParam) {
      try {
        const tables = JSON.parse(decodeURIComponent(tablesParam))
        setRelevantTables(Array.isArray(tables) ? tables : [])
      } catch (error) {
        console.error("Failed to parse tables parameter:", error)
        setRelevantTables([])
      }
    }

    // Handle pre-filled SQL from parameterized reports
    const sqlParam = searchParams.get("sql")
    if (sqlParam) {
      const sql = decodeURIComponent(sqlParam)
      setEditableSql(sql)
      // Create a fake query result so the UI shows the SQL editor and execute button
      setQueryResult({
        sql: sql,
        explanation: "Query loaded from saved report with parameter values applied",
        confidence: 1.0,
        warnings: []
      })
    }
  }, [searchParams]);

  useEffect(() => {
    if (queryResult?.sql) {
      setEditableSql(queryResult.sql)
    }
  }, [queryResult]);

  const connectionInformation = useDatabaseOptions();

  const handleGenerateSQLClick = () => {
    // Check if there are existing results to clear
    if (queryResult || executionResults) {
      setShowClearConfirmation(true)
    } else {
      generateSQL()
    }
  }

  const handleConfirmClear = () => {
    // Clear existing results
    setQueryResult(null)
    setExecutionResults(null)
    setEditableSql("")
    setShowClearConfirmation(false)
    // Generate new SQL
    generateSQL()
  }

  const generateSQL = async () => {
    if (!naturalQuery.trim()) return

    setIsGenerating(true)
    setError("")

    try {
      let connection = connectionInformation.getConnection();

      if (!connection?.schemaFileId) {
        throw new Error("You must upload schema information file before creating queries!");
      }

      // Get the schema data for potential re-upload
      const schema = connectionInformation.getSchema();

      const response = await fetch("/api/query/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: naturalQuery,
          vectorStoreId: connection.vectorStoreId,
          databaseType: connection.type,
          schemaData: schema,
          existingFileId: connection.schemaFileId
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to generate SQL")
      }

      const result = await response.json()

      // Check if schema was re-uploaded and update connection with new IDs
      if (result.schemaReuploaded && result.newFileId && result.newVectorStoreId) {
        console.log("Schema was re-uploaded. Updating connection with new IDs...");
        const updatedConnection = {
          ...connection,
          schemaFileId: result.newFileId,
          vectorStoreId: result.newVectorStoreId
        };
        connectionInformation.updateConnection(updatedConnection);
        toast({
          title: "Schema Re-uploaded",
          description: "Vector store was invalid and has been automatically re-created",
        });
      }

      setQueryResult(result)
      toast({
        title: "SQL Generated Successfully",
        description: `Query generated with ${Math.round(result.confidence * 100)}% confidence`,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate SQL"
      setError(errorMessage)
      toast({
        title: "SQL Generation Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const executeSQL = async () => {
    if (!editableSql) return // Use editableSql instead of queryResult.sql

    setIsExecuting(true)
    setError("")

    try {
      const activeConnection = connectionInformation.getConnection();

      const response = await fetch("/api/query/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: editableSql, // Use editableSql instead of queryResult.sql
          connection: activeConnection,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to execute query")
      }

      const result = await response.json()
      setExecutionResults(result)
      toast({
        title: "Query Executed Successfully",
        description: `Returned ${result.rowCount} rows in ${result.executionTime}ms`,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to execute query"
      setError(errorMessage)
      toast({
        title: "Query Execution Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const saveReport = (name: string, description: string, parameters: ReportParameter[]) => {
    if (!queryResult || !naturalQuery) return

    const activeConnection = connectionInformation.getConnection()
    if (!activeConnection) {
      toast({
        title: "Error",
        description: "No active database connection",
        variant: "destructive",
      })
      return
    }

    const report: SavedReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      connectionId: activeConnection.id,
      name,
      description,
      naturalLanguageQuery: naturalQuery,
      sql: editableSql,
      explanation: queryResult.explanation,
      warnings: queryResult.warnings,
      confidence: queryResult.confidence,
      parameters: parameters.length > 0 ? parameters : undefined,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    }

    // Get existing reports
    const existingReports = storage.get<SavedReport[]>(StorageKeys.SAVED_REPORTS, [])
    existingReports.push(report)
    storage.set(StorageKeys.SAVED_REPORTS, existingReports)

    toast({
      title: "Report Saved",
      description: `"${name}" has been saved successfully`,
    })
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Natural Language Query</h1>
          <p className="text-muted-foreground">Ask questions about your data in plain English</p>
        </div>

        {/* AI Operation Banner */}
        <AIOperationBanner
          isVisible={isGenerating}
          message="Generating SQL query using AI. This may take a moment..."
        />

        {/* Connection Selector */}
        {connectionInformation.connections.length > 1 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Label htmlFor="connection-select" className="text-sm font-medium whitespace-nowrap">
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
                  <SelectTrigger id="connection-select" className="w-full max-w-md">
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

        {/* Query Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              Ask Your Question
            </CardTitle>
            <CardDescription>Describe what data you want to see in natural language</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="e.g., Show me all customers who made purchases over $1000 in the last month"
              value={naturalQuery}
              onChange={(e) => setNaturalQuery(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <Button
              onClick={handleGenerateSQLClick}
              disabled={!naturalQuery.trim() || isGenerating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating SQL...
                </>
              ) : (
                "Generate SQL Query"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Generated SQL */}
        {queryResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Generated SQL Query</span>
                <Badge variant={queryResult.confidence > 0.8 ? "default" : "secondary"}>
                  {Math.round(queryResult.confidence * 100)}% Confidence
                </Badge>
              </CardTitle>
              <CardDescription>{queryResult.explanation}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Warnings */}
              {queryResult.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warnings:</strong>
                    <ul className="mt-1 list-disc list-inside">
                      {queryResult.warnings.map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* SQL Code */}
              <div className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                <textarea
                    value={editableSql}
                    onChange={(e) => setEditableSql(e.target.value)}
                    className="w-full h-32 bg-transparent border-none resize-none outline-none text-slate-100 font-mono text-sm"
                />

              </div>

              <div className="flex gap-2">
                <Button onClick={executeSQL} disabled={isExecuting} className="bg-green-600 hover:bg-green-700">
                  {isExecuting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Execute Query
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowSaveDialog(true)}>
                  <Save className="h-4 w-4 mr-2" />
                  Save as Report
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Query Results */}
        {executionResults && <QueryResultsDisplay data={executionResults} />}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      <Toaster />
      <SaveReportDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={saveReport}
        defaultName={naturalQuery.slice(0, 50) + (naturalQuery.length > 50 ? "..." : "")}
        sql={editableSql}
      />
      <AlertDialog open={showClearConfirmation} onOpenChange={setShowClearConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Existing Results?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the current Generated SQL Query and Query Results. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClear}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
