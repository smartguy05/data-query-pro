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
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ReportParameter } from "@/models/saved-report.interface"
import { Play } from "lucide-react"

interface ParameterInputDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parameters: ReportParameter[]
  onRun: (values: Record<string, any>) => void
  reportName: string
}

export function ParameterInputDialog({
  open,
  onOpenChange,
  parameters,
  onRun,
  reportName
}: ParameterInputDialogProps) {
  const [values, setValues] = useState<Record<string, any>>({})

  // Initialize with default values when dialog opens
  useEffect(() => {
    if (open && parameters.length > 0) {
      const defaultValues: Record<string, any> = {}
      parameters.forEach(param => {
        defaultValues[param.name] = param.defaultValue || ''
      })
      setValues(defaultValues)
    }
  }, [open, parameters])

  const handleRun = () => {
    onRun(values)
    onOpenChange(false)
  }

  const updateValue = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }

  const renderInput = (param: ReportParameter) => {
    switch (param.type) {
      case 'number':
        return (
          <Input
            type="number"
            value={values[param.name] || ''}
            onChange={(e) => updateValue(param.name, e.target.value)}
            placeholder={param.description || `Enter ${param.label.toLowerCase()}`}
          />
        )

      case 'date':
        return (
          <Input
            type="date"
            value={values[param.name] || ''}
            onChange={(e) => updateValue(param.name, e.target.value)}
          />
        )

      case 'datetime':
        return (
          <Input
            type="datetime-local"
            value={values[param.name] || ''}
            onChange={(e) => updateValue(param.name, e.target.value)}
          />
        )

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={values[param.name] === 'true' || values[param.name] === true}
              onCheckedChange={(checked) => updateValue(param.name, checked.toString())}
              id={`param-${param.name}`}
            />
            <Label htmlFor={`param-${param.name}`} className="font-normal">
              {param.description || 'Enable this option'}
            </Label>
          </div>
        )

      case 'text':
      default:
        return (
          <Input
            type="text"
            value={values[param.name] || ''}
            onChange={(e) => updateValue(param.name, e.target.value)}
            placeholder={param.description || `Enter ${param.label.toLowerCase()}`}
          />
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Run Report: {reportName}</DialogTitle>
          <DialogDescription>
            This report requires parameters. Please fill in the values below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {parameters.map((param) => (
            <div key={param.name} className="space-y-2">
              <Label htmlFor={`param-${param.name}`}>
                {param.label}
                {param.description && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ({param.description})
                  </span>
                )}
              </Label>
              {renderInput(param)}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleRun} className="bg-green-600 hover:bg-green-700">
            <Play className="h-4 w-4 mr-2" />
            Run Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
