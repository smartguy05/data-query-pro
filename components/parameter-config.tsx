"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ReportParameter } from "@/models/saved-report.interface"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

interface ParameterConfigProps {
  parameters: ReportParameter[]
  onChange: (parameters: ReportParameter[]) => void
}

export function ParameterConfig({ parameters, onChange }: ParameterConfigProps) {
  const updateParameter = (index: number, field: keyof ReportParameter, value: any) => {
    const updated = [...parameters]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  if (parameters.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          Parameters Detected
        </CardTitle>
        <CardDescription>
          Configure the parameters found in your SQL query ({`{{name}}`})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {parameters.map((param, index) => (
          <div key={param.name} className="space-y-3 p-4 border rounded-lg">
            <div className="font-medium text-sm">
              Parameter: <code className="bg-muted px-2 py-1 rounded">{`{{${param.name}}}`}</code>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`label-${index}`}>Display Label</Label>
                <Input
                  id={`label-${index}`}
                  placeholder="e.g., Start Date"
                  value={param.label}
                  onChange={(e) => updateParameter(index, 'label', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`type-${index}`}>Input Type</Label>
                <Select
                  value={param.type}
                  onValueChange={(value) => updateParameter(index, 'type', value)}
                >
                  <SelectTrigger id={`type-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="datetime">Date & Time</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`default-${index}`}>Default Value</Label>
              <Input
                id={`default-${index}`}
                placeholder="Optional default value"
                value={param.defaultValue || ''}
                onChange={(e) => updateParameter(index, 'defaultValue', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`description-${index}`}>Description (optional)</Label>
              <Textarea
                id={`description-${index}`}
                placeholder="Help text for this parameter"
                value={param.description || ''}
                onChange={(e) => updateParameter(index, 'description', e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
