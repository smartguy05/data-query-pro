"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { RowLimitOption } from "@/models/query-tab.interface"

interface FollowUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (question: string, rowLimit: RowLimitOption) => void
  isLoading: boolean
  currentRowCount: number
  rowLimit: RowLimitOption
  onRowLimitChange: (limit: RowLimitOption) => void
}

export function FollowUpDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  currentRowCount,
  rowLimit,
  onRowLimitChange
}: FollowUpDialogProps) {
  const [question, setQuestion] = useState("")

  const handleSubmit = () => {
    if (!question.trim() || isLoading) return
    onSubmit(question.trim(), rowLimit)
    setQuestion("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey && question.trim() && !isLoading) {
      handleSubmit()
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen)
      if (!newOpen) {
        setQuestion("")
      }
    }
  }

  const getRowLimitLabel = (limit: RowLimitOption): string => {
    if (limit === 'none') {
      return 'None (schema only)'
    }
    if (limit === 'all') {
      return `All rows (${currentRowCount})`
    }
    return `First ${limit} rows`
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask a Follow-up Question</DialogTitle>
          <DialogDescription>
            Ask a question about the data. The AI will either generate a new query
            or explain the current results based on your question.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="followup-question">Your Question</Label>
            <Textarea
              id="followup-question"
              placeholder="e.g., Why is Q4 revenue lower than Q3? or Show me only customers from California..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[100px]"
              disabled={isLoading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Press Ctrl+Enter to submit
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="row-limit">Data to Send to AI</Label>
            <Select
              value={String(rowLimit)}
              onValueChange={(v) => {
                if (v === 'none' || v === 'all') {
                  onRowLimitChange(v)
                } else {
                  onRowLimitChange(Number(v) as RowLimitOption)
                }
              }}
              disabled={isLoading}
            >
              <SelectTrigger id="row-limit">
                <SelectValue>{getRowLimitLabel(rowLimit)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (schema only)</SelectItem>
                <SelectItem value="25">First 25 rows</SelectItem>
                <SelectItem value="50">First 50 rows</SelectItem>
                <SelectItem value="100">First 100 rows</SelectItem>
                <SelectItem value="all" disabled={currentRowCount > 500}>
                  All rows {currentRowCount > 500 ? "(max 500)" : `(${currentRowCount})`}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              More data gives better context but increases processing time.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!question.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Ask Question"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
