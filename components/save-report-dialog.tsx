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
import { ReportParameter } from "@/models/saved-report.interface"
import { ParameterConfig } from "./parameter-config"

interface SaveReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string, description: string, parameters: ReportParameter[]) => void
  defaultName?: string
  sql?: string
}

export function SaveReportDialog({ open, onOpenChange, onSave, defaultName, sql }: SaveReportDialogProps) {
  const [name, setName] = useState(defaultName || "")
  const [description, setDescription] = useState("")
  const [parameters, setParameters] = useState<ReportParameter[]>([])

  // Detect parameters in SQL when dialog opens
  useEffect(() => {
    if (open && sql) {
      const paramPattern = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g
      const matches = [...sql.matchAll(paramPattern)]
      const uniqueParams = [...new Set(matches.map(m => m[1]))]

      const detectedParams: ReportParameter[] = uniqueParams.map(name => ({
        name,
        type: 'text' as const,
        label: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        defaultValue: '',
        description: ''
      }))

      setParameters(detectedParams)
    }
  }, [open, sql])

  const handleSave = () => {
    if (!name.trim()) return
    onSave(name.trim(), description.trim(), parameters)
    setName("")
    setDescription("")
    setParameters([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save Query as Report</DialogTitle>
          <DialogDescription>
            Save this query so you can easily re-run it later
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Report Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Monthly Sales Summary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  handleSave()
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Add notes about what this report shows..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
              rows={3}
            />
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
          <Button onClick={handleSave} disabled={!name.trim()} className="bg-blue-600 hover:bg-blue-700">
            Save Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
