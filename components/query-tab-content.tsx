"use client"

import { useEffect, useRef } from "react"
import { QueryTab } from "@/models/query-tab.interface"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Play, Save, AlertTriangle, Sparkles } from "lucide-react"
import { QueryResultsDisplay } from "@/components/query-results-display"

interface QueryTabContentProps {
  tab: QueryTab
  onEditSql: (sql: string) => void
  onExecute: () => void
  onAskFollowUp: () => void
  onSaveReport: () => void
  onReviseQuery?: () => void
  isExecuting: boolean
  isRevising?: boolean
}

export function QueryTabContent({
  tab,
  onEditSql,
  onExecute,
  onAskFollowUp,
  onSaveReport,
  onReviseQuery,
  isExecuting,
  isRevising = false
}: QueryTabContentProps) {
  const resultsRef = useRef<HTMLDivElement>(null)

  // Scroll to results when they arrive
  useEffect(() => {
    if (tab.executionResults && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [tab.executionResults])

  // Loading state - AI is processing the question
  if (tab.isGenerating) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-4" />
            <span className="text-lg">Processing your question...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state - generation failed
  if (tab.generationError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{tab.generationError}</AlertDescription>
        </Alert>
        <div className="flex justify-center">
          <Button variant="outline" onClick={onAskFollowUp}>
            <Sparkles className="h-4 w-4 mr-2" />
            Try Another Question
          </Button>
        </div>
      </div>
    )
  }

  // Explanation response - AI provided analysis instead of a query
  if (tab.responseType === 'explanation' && tab.explanationResponse) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Analysis
            </CardTitle>
            <CardDescription>
              Response to: &quot;{tab.question}&quot;
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
              {tab.explanationResponse.text}
            </div>
            {tab.explanationResponse.confidence && (
              <Badge variant="secondary">
                {Math.round(tab.explanationResponse.confidence * 100)}% Confidence
              </Badge>
            )}
          </CardContent>
        </Card>
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onAskFollowUp}
            className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Ask Another Question
          </Button>
        </div>
      </div>
    )
  }

  // Query response - AI generated SQL
  if (tab.queryResult) {
    return (
      <div className="space-y-6">
        {/* SQL Display Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{tab.type === 'original' ? 'Generated SQL Query' : 'Follow-up Query'}</span>
              <Badge variant={tab.queryResult.confidence > 0.8 ? "default" : "secondary"}>
                {Math.round(tab.queryResult.confidence * 100)}% Confidence
              </Badge>
            </CardTitle>
            <CardDescription>{tab.queryResult.explanation}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Warnings */}
            {tab.queryResult.warnings && tab.queryResult.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warnings:</strong>
                  <ul className="mt-1 list-disc list-inside">
                    {tab.queryResult.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Editable SQL */}
            <div className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
              <textarea
                value={tab.editableSql || ''}
                onChange={(e) => onEditSql(e.target.value)}
                className="w-full h-32 bg-transparent border-none resize-none outline-none text-slate-100 font-mono text-sm"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={onExecute}
                disabled={isExecuting || !tab.editableSql?.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
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
              <Button variant="outline" onClick={onSaveReport}>
                <Save className="h-4 w-4 mr-2" />
                Save as Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Execution Error */}
        {tab.executionError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-start justify-between gap-4">
              <span>{tab.executionError}</span>
              {onReviseQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReviseQuery}
                  disabled={isRevising}
                  className="shrink-0 bg-background hover:bg-muted"
                >
                  {isRevising ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Revising...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Revise Query
                    </>
                  )}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Results Display */}
        {tab.executionResults && (
          <div ref={resultsRef} className="space-y-4">
            {/* Ask Follow-up Button - above results for visibility */}
            <div className="flex justify-end">
              <Button
                onClick={onAskFollowUp}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Ask a Question About These Results
              </Button>
            </div>

            <QueryResultsDisplay data={tab.executionResults} />
          </div>
        )}
      </div>
    )
  }

  // Fallback - nothing to display
  return null
}
