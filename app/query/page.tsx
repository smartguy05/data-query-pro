"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Loader2, Play, Database, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { QueryResultsDisplay } from "@/components/query-results-display"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {useDatabaseOptions} from "@/lib/database-connection-options";

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

  useEffect(() => {
    const queryParam = searchParams.get("suggestion")
    if (queryParam) {
      setNaturalQuery(decodeURIComponent(queryParam))
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
  }, [searchParams]);

  useEffect(() => {
    if (queryResult?.sql) {
      setEditableSql(queryResult.sql)
    }
  }, [queryResult]);

  const connectionInformation = useDatabaseOptions();

  const generateSQL = async () => {
    if (!naturalQuery.trim()) return

    setIsGenerating(true)
    setError("")

    try {
      let connection = connectionInformation.getConnection();

      if (!connection?.schemaFileId) {
        throw new Error("You must upload schema information file before creating queries!");
      }
      
      const response = await fetch("/api/query/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: naturalQuery,
          vectorStoreId: connection.vectorStoreId,
          databaseType: connection.type
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to generate SQL")
      }

      const result = await response.json()
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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Natural Language Query</h1>
          <p className="text-slate-600">Ask questions about your data in plain English</p>
        </div>

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
              onClick={generateSQL}
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
              <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
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
                <Button variant="outline">Save Query</Button>
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
    </div>
  )
}
