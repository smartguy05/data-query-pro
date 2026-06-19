"use client"

import { useState, useEffect, useMemo } from "react"
import type { Schema } from "@/models/schema.interface"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Info } from "lucide-react"
import { useDatabaseOptions } from "@/lib/database-connection-options"
import {
  copyDescriptions,
  type CopyDescriptionsOptions,
  type CopyDescriptionsStats,
} from "@/utils/copy-descriptions"

interface CopyDescriptionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetSchema: Schema | undefined
  onApply: (newSchema: Schema, stats: CopyDescriptionsStats) => void
}

export function CopyDescriptionsDialog({
  open,
  onOpenChange,
  targetSchema,
  onApply,
}: CopyDescriptionsDialogProps) {
  const { connections, getSchema } = useDatabaseOptions()

  const [sourceId, setSourceId] = useState<string>("")
  const [mode, setMode] = useState<CopyDescriptionsOptions["mode"]>("fill-empty")
  const [includeAiDescriptions, setIncludeAiDescriptions] = useState(true)
  const [includeVisibility, setIncludeVisibility] = useState(true)

  // Reset selection each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSourceId("")
      setMode("fill-empty")
      setIncludeAiDescriptions(true)
      setIncludeVisibility(true)
    }
  }, [open])

  // Candidate source connections: not the target, and have a saved schema with tables.
  const sourceOptions = useMemo(() => {
    return connections
      .filter((conn) => conn.id !== targetSchema?.connectionId)
      .map((conn) => ({ conn, schema: getSchema(conn.id) }))
      .filter((entry) => !!entry.schema && entry.schema.tables.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, targetSchema?.connectionId, open])

  const options: CopyDescriptionsOptions = { mode, includeAiDescriptions, includeVisibility }

  // Live preview of what would be copied with the current selection.
  const preview = useMemo(() => {
    if (!targetSchema || !sourceId) return null
    const source = getSchema(sourceId)
    if (!source) return null
    return copyDescriptions(targetSchema, source, options)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSchema, sourceId, mode, includeAiDescriptions, includeVisibility])

  const handleApply = () => {
    if (!preview) return
    onApply(preview.schema, preview.stats)
    onOpenChange(false)
  }

  const stats = preview?.stats

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Copy Schema Descriptions</DialogTitle>
          <DialogDescription>
            Copy descriptions from another connection&apos;s schema into this one, matching tables and
            columns by name. Useful for the same database across environments.
          </DialogDescription>
        </DialogHeader>

        {sourceOptions.length === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No other connection has a saved schema to copy from. Introspect a schema on another
              connection first.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-5 py-2">
            {/* Source connection */}
            <div className="space-y-2">
              <Label htmlFor="copy-source-select">Copy from</Label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger id="copy-source-select">
                  <SelectValue placeholder="Select a source connection" />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map(({ conn, schema }) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.name || conn.database} ({schema!.tables.length} tables)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Overwrite rule */}
            <div className="space-y-2">
              <Label>When a description already exists on this connection</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as CopyDescriptionsOptions["mode"])}>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="fill-empty" id="mode-fill" className="mt-1" />
                  <Label htmlFor="mode-fill" className="font-normal">
                    Fill empty only
                    <span className="block text-xs text-muted-foreground">
                      Keep existing descriptions; only fill in the blanks.
                    </span>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="overwrite" id="mode-overwrite" className="mt-1" />
                  <Label htmlFor="mode-overwrite" className="font-normal">
                    Overwrite existing
                    <span className="block text-xs text-muted-foreground">
                      Replace matching descriptions with the source&apos;s.
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Scope toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="copy-ai" className="font-normal">
                  Include AI descriptions
                  <span className="block text-xs text-muted-foreground">
                    Copy AI-generated descriptions, not just manual ones.
                  </span>
                </Label>
                <Switch id="copy-ai" checked={includeAiDescriptions} onCheckedChange={setIncludeAiDescriptions} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="copy-visibility" className="font-normal">
                  Include visibility settings
                  <span className="block text-xs text-muted-foreground">
                    Mirror which tables/columns are hidden from queries.
                  </span>
                </Label>
                <Switch id="copy-visibility" checked={includeVisibility} onCheckedChange={setIncludeVisibility} />
              </div>
            </div>

            {/* Live preview */}
            {stats && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">{stats.tablesMatched}</span> tables matched
                  {stats.tablesUnmatched > 0 && (
                    <> · <span className="font-medium">{stats.tablesUnmatched}</span> with no match (skipped)</>
                  )}
                  <br />
                  <span className="font-medium">{stats.tableDescriptionsCopied + stats.columnDescriptionsCopied}</span>{" "}
                  descriptions will be copied
                  {" "}({stats.tableDescriptionsCopied} table, {stats.columnDescriptionsCopied} column)
                  {includeVisibility && (
                    <>
                      <br />
                      <span className="font-medium">{stats.visibilityChanged}</span> visibility flags will change
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!sourceId || !preview}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
