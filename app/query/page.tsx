"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Database } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { useDatabaseOptions } from "@/lib/database-connection-options"
import { SaveReportDialog } from "@/components/save-report-dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QueryTab, QueryResult, RowLimitOption, FollowUpResponse } from "@/models/query-tab.interface"
import { QueryTabContent } from "@/components/query-tab-content"
import { FollowUpDialog } from "@/components/followup-dialog"

export default function QueryPage() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Original query input
  const [naturalQuery, setNaturalQuery] = useState("")
  const [isGeneratingOriginal, setIsGeneratingOriginal] = useState(false)

  // Tab management
  const [tabs, setTabs] = useState<QueryTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  // Follow-up dialog
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false)
  const [followUpParentTabId, setFollowUpParentTabId] = useState<string | null>(null)
  const [isProcessingFollowUp, setIsProcessingFollowUp] = useState(false)
  const [rowLimit, setRowLimit] = useState<RowLimitOption>('none')

  // Save report dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveTabId, setSaveTabId] = useState<string | null>(null)

  // Clear confirmation dialog
  const [showClearConfirmation, setShowClearConfirmation] = useState(false)

  const connectionInformation = useDatabaseOptions()

  // Handle URL parameters
  useEffect(() => {
    const queryParam = searchParams.get("suggestion")
    const descriptionParam = searchParams.get("description")

    if (queryParam) {
      if (descriptionParam) {
        const description = decodeURIComponent(descriptionParam)
        const query = decodeURIComponent(queryParam)
        setNaturalQuery(`Goal: ${description}\n\nQuery: ${query}`)
      } else {
        setNaturalQuery(decodeURIComponent(queryParam))
      }
    }

    // Handle pre-filled SQL from parameterized reports
    const sqlParam = searchParams.get("sql")
    if (sqlParam) {
      const sql = decodeURIComponent(sqlParam)
      const queryResult: QueryResult = {
        sql: sql,
        explanation: "Query loaded from saved report with parameter values applied",
        confidence: 1.0,
        warnings: []
      }
      const tab = createOriginalTab("Saved Report Query", queryResult)
      setTabs([tab])
      setActiveTabId(tab.id)
    }
  }, [searchParams])

  // Clear tabs when connection changes
  useEffect(() => {
    const currentConnId = connectionInformation.currentConnection?.id
    if (currentConnId && tabs.length > 0) {
      // Check if we have tabs from a different connection
      // We don't store connectionId on tabs, so we'll reset on any connection change
      // This is handled by the user selecting a different connection
    }
  }, [connectionInformation.currentConnection?.id])

  // Helper: Create original tab
  const createOriginalTab = (question: string, result: QueryResult): QueryTab => ({
    id: `tab_${Date.now()}`,
    type: 'original',
    question,
    parentTabId: null,
    isGenerating: false,
    isExecuting: false,
    queryResult: result,
    editableSql: result.sql,
    responseType: 'query',
    createdAt: new Date().toISOString(),
  })

  // Helper: Create follow-up tab (in loading state)
  const createFollowUpTab = (question: string, parentTabId: string): QueryTab => ({
    id: `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'followup',
    question,
    parentTabId,
    isGenerating: true,
    isExecuting: false,
    createdAt: new Date().toISOString(),
  })

  // Helper: Update a specific tab
  const updateTab = (tabId: string, updates: Partial<QueryTab>) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, ...updates } : tab
    ))
  }

  // Helper: Get rows limited by user preference
  const getLimitedRows = (rows: any[][], limit: RowLimitOption): any[][] => {
    if (limit === 'none') return []
    if (limit === 'all') return rows
    return rows.slice(0, limit)
  }

  // Helper: Get follow-up tab number
  const getTabLabel = (tab: QueryTab, index: number): string => {
    if (tab.type === 'original') return 'Original Query'
    return `Follow-up ${index}`
  }

  // Handle generate SQL click
  const handleGenerateSQLClick = () => {
    if (tabs.length > 0) {
      setShowClearConfirmation(true)
    } else {
      generateOriginalSQL()
    }
  }

  // Confirm clearing existing results
  const handleConfirmClear = () => {
    setTabs([])
    setActiveTabId(null)
    setShowClearConfirmation(false)
    generateOriginalSQL()
  }

  // Generate SQL for original query
  const generateOriginalSQL = async () => {
    if (!naturalQuery.trim()) return

    setIsGeneratingOriginal(true)

    try {
      const connection = connectionInformation.getConnection()

      if (!connection?.schemaFileId) {
        throw new Error("You must upload schema information file before creating queries!")
      }

      const schema = connectionInformation.getSchema()

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

      // Check if schema was re-uploaded
      if (result.schemaReuploaded && result.newFileId && result.newVectorStoreId) {
        const updatedConnection = {
          ...connection,
          schemaFileId: result.newFileId,
          vectorStoreId: result.newVectorStoreId
        }
        connectionInformation.updateConnection(updatedConnection)
        toast({
          title: "Schema Re-uploaded",
          description: "Vector store was invalid and has been automatically re-created",
        })
      }

      // Create the original tab
      const tab = createOriginalTab(naturalQuery, result)
      setTabs([tab])
      setActiveTabId(tab.id)

      toast({
        title: "SQL Generated Successfully",
        description: `Query generated with ${Math.round(result.confidence * 100)}% confidence`,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate SQL"
      toast({
        title: "SQL Generation Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingOriginal(false)
    }
  }

  // Execute SQL for a specific tab
  const executeTabQuery = async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId)
    if (!tab?.editableSql) return

    updateTab(tabId, { isExecuting: true, executionError: undefined })

    try {
      const activeConnection = connectionInformation.getConnection()

      const response = await fetch("/api/query/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: tab.editableSql,
          connection: activeConnection,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to execute query")
      }

      const result = await response.json()
      updateTab(tabId, {
        isExecuting: false,
        executionResults: result,
        executionError: undefined
      })

      toast({
        title: "Query Executed Successfully",
        description: `Returned ${result.rowCount} rows in ${result.executionTime}ms`,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to execute query"
      updateTab(tabId, {
        isExecuting: false,
        executionError: errorMessage
      })
      toast({
        title: "Query Execution Failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  // Handle follow-up question submission
  const handleFollowUp = async (question: string, limit: RowLimitOption) => {
    const parentTab = tabs.find(t => t.id === followUpParentTabId)
    if (!parentTab?.executionResults) return

    setIsProcessingFollowUp(true)

    // Create new tab in loading state
    const newTab = createFollowUpTab(question, parentTab.id)
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
    setShowFollowUpDialog(false)

    try {
      const connection = connectionInformation.getConnection()
      if (!connection?.vectorStoreId) {
        throw new Error("No vector store available")
      }

      const response = await fetch('/api/query/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followUpQuestion: question,
          originalQuestion: parentTab.question,
          generatedSql: parentTab.queryResult?.sql || parentTab.editableSql,
          resultColumns: parentTab.executionResults.columns,
          resultRows: getLimitedRows(parentTab.executionResults.rows, limit),
          totalRowCount: parentTab.executionResults.rowCount,
          vectorStoreId: connection.vectorStoreId,
          databaseType: connection.type,
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to process follow-up")
      }

      const result: FollowUpResponse = await response.json()

      // Update the tab based on response type
      if (result.responseType === 'query') {
        updateTab(newTab.id, {
          isGenerating: false,
          responseType: 'query',
          queryResult: {
            sql: result.sql || '',
            explanation: result.explanation || '',
            confidence: result.confidence || 0.8,
            warnings: result.warnings || []
          },
          editableSql: result.sql || ''
        })
        toast({
          title: "Follow-up Query Generated",
          description: `Query generated with ${Math.round((result.confidence || 0.8) * 100)}% confidence`,
        })
      } else {
        updateTab(newTab.id, {
          isGenerating: false,
          responseType: 'explanation',
          explanationResponse: {
            text: result.explanationText || '',
            confidence: result.confidence || 0.8
          }
        })
        toast({
          title: "Analysis Complete",
          description: "AI has analyzed your question",
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process follow-up"
      updateTab(newTab.id, {
        isGenerating: false,
        generationError: errorMessage
      })
      toast({
        title: "Follow-up Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsProcessingFollowUp(false)
    }
  }

  // Open follow-up dialog for a specific tab
  const openFollowUpDialog = (tabId: string) => {
    setFollowUpParentTabId(tabId)
    setShowFollowUpDialog(true)
  }

  // Open save dialog for a specific tab
  const openSaveDialog = (tabId: string) => {
    setSaveTabId(tabId)
    setShowSaveDialog(true)
  }

  // Save report for a tab
  const saveReport = (name: string, description: string, parameters: ReportParameter[]) => {
    const tab = tabs.find(t => t.id === saveTabId)
    if (!tab?.queryResult) return

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
      naturalLanguageQuery: tab.question,
      sql: tab.editableSql || tab.queryResult.sql,
      explanation: tab.queryResult.explanation,
      warnings: tab.queryResult.warnings,
      confidence: tab.queryResult.confidence,
      parameters: parameters.length > 0 ? parameters : undefined,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    }

    const existingReports = JSON.parse(localStorage.getItem("saved_reports") || "[]") as SavedReport[]
    existingReports.push(report)
    localStorage.setItem("saved_reports", JSON.stringify(existingReports))

    toast({
      title: "Report Saved",
      description: `"${name}" has been saved successfully`,
    })
  }

  // Get current tab for save dialog
  const currentSaveTab = tabs.find(t => t.id === saveTabId)
  const currentFollowUpTab = tabs.find(t => t.id === followUpParentTabId)

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Natural Language Query</h1>
          <p className="text-muted-foreground">Ask questions about your data in plain English</p>
        </div>

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
                      // Reset tabs when switching connections
                      setTabs([])
                      setActiveTabId(null)
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
              disabled={!naturalQuery.trim() || isGeneratingOriginal}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGeneratingOriginal ? (
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

        {/* Tabs for Query Results */}
        {tabs.length > 0 && (
          <Card>
            <Tabs value={activeTabId || tabs[0]?.id} onValueChange={setActiveTabId}>
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <TabsList className="flex-wrap h-auto gap-1">
                    {tabs.map((tab, index) => (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="relative data-[state=active]:bg-background"
                      >
                        {getTabLabel(tab, index)}
                        {tab.isGenerating && (
                          <Loader2 className="h-3 w-3 ml-1 animate-spin" />
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {tabs.map(tab => (
                  <TabsContent key={tab.id} value={tab.id} className="mt-0">
                    <QueryTabContent
                      tab={tab}
                      onEditSql={(sql) => updateTab(tab.id, { editableSql: sql })}
                      onExecute={() => executeTabQuery(tab.id)}
                      onAskFollowUp={() => openFollowUpDialog(tab.id)}
                      onSaveReport={() => openSaveDialog(tab.id)}
                      isExecuting={tab.isExecuting}
                    />
                  </TabsContent>
                ))}
              </CardContent>
            </Tabs>
          </Card>
        )}
      </div>

      <Toaster />

      {/* Follow-up Dialog */}
      <FollowUpDialog
        open={showFollowUpDialog}
        onOpenChange={setShowFollowUpDialog}
        onSubmit={handleFollowUp}
        isLoading={isProcessingFollowUp}
        currentRowCount={currentFollowUpTab?.executionResults?.rowCount || 0}
        rowLimit={rowLimit}
        onRowLimitChange={setRowLimit}
      />

      {/* Save Report Dialog */}
      <SaveReportDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={saveReport}
        defaultName={currentSaveTab?.question.slice(0, 50) + ((currentSaveTab?.question.length || 0) > 50 ? "..." : "")}
        sql={currentSaveTab?.editableSql || currentSaveTab?.queryResult?.sql}
      />

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={showClearConfirmation} onOpenChange={setShowClearConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Existing Results?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all current query results and follow-up tabs. Are you sure you want to continue?
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
