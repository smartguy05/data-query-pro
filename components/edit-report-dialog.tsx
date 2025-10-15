"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ReportParameter, SavedReport } from "@/models/saved-report.interface"
import { ParameterConfig } from "./parameter-config"
import { RefreshCw } from "lucide-react"

interface EditReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (updatedReport: SavedReport) => void
  report: SavedReport | null
}

export function EditReportDialog({ open, onOpenChange, onSave, report }: EditReportDialogProps) {
  // Detect initial parameters from SQL
  const getInitialParameters = (): ReportParameter[] => {
    if (!report) return []

    const paramPattern = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g
    const matches = [...report.sql.matchAll(paramPattern)]
    const uniqueParamNames = [...new Set(matches.map(m => m[1]))]

    const existingParamMap = new Map((report.parameters || []).map(p => [p.name, p]))

    return uniqueParamNames.map(paramName => {
      if (existingParamMap.has(paramName)) {
        return existingParamMap.get(paramName)!
      }
      return {
        name: paramName,
        type: 'text' as const,
        label: paramName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        defaultValue: '',
        description: ''
      }
    })
  }

  const [name, setName] = useState(report?.name || "")
  const [description, setDescription] = useState(report?.description || "")
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState(report?.naturalLanguageQuery || "")
  const [sql, setSql] = useState(report?.sql || "")
  const [parameters, setParameters] = useState<ReportParameter[]>(getInitialParameters())

  const refreshParameters = () => {
    if (!sql) return

    const paramPattern = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g
    const matches = [...sql.matchAll(paramPattern)]
    const uniqueParamNames = [...new Set(matches.map(m => m[1]))]

    // Keep existing parameter configurations where they exist
    const existingParamMap = new Map(parameters.map(p => [p.name, p]))

    const detectedParams: ReportParameter[] = uniqueParamNames.map(paramName => {
      if (existingParamMap.has(paramName)) {
        return existingParamMap.get(paramName)!
      }
      return {
        name: paramName,
        type: 'text' as const,
        label: paramName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        defaultValue: '',
        description: ''
      }
    })

    setParameters(detectedParams)
  }

  const handleSave = () => {
    if (!name.trim() || !report) return

    const updatedReport: SavedReport = {
      ...report,
      name: name.trim(),
      description: description.trim(),
      naturalLanguageQuery: naturalLanguageQuery.trim(),
      sql: sql.trim(),
      parameters: parameters.length > 0 ? parameters : undefined,
      lastModified: new Date().toISOString(),
    }

    onSave(updatedReport)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Report</DialogTitle>
          <DialogDescription>
            Modify report details and SQL. Add parameters using {`{{variableName}}`} syntax.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Report Name *</Label>
            <Input
              id="edit-name"
              placeholder="e.g., Monthly Sales Summary"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <Textarea
              id="edit-description"
              placeholder="Add notes about what this report shows..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-natural-query">Original Question</Label>
            <Textarea
              id="edit-natural-query"
              placeholder="The natural language query that generated this SQL"
              value={naturalLanguageQuery}
              onChange={(e) => setNaturalLanguageQuery(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-sql">SQL Query *</Label>
            <div className="text-sm text-muted-foreground mb-1">
              Use {`{{variableName}}`} to add parameters. Example: WHERE name = {`{{customer_name}}`}
            </div>
            <Textarea
              id="edit-sql"
              placeholder="SELECT * FROM..."
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              className="font-mono text-sm resize-none"
              rows={8}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refreshParameters}
              className="mt-2"
            >
              <RefreshCw className="h-3 w-3 mr-2" />
              Refresh Parameters
            </Button>
          </div>

          {/* Parameter Configuration */}
          {parameters.length > 0 && (
            <ParameterConfig parameters={parameters} onChange={setParameters} />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !sql.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
