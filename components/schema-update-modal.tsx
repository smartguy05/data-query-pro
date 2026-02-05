"use client"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle } from "lucide-react"

interface SchemaUpdateModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    schema: Schema | null
    onConfirm: () => void
    onCancel: () => void
}

export function SchemaUpdateModal({
    open,
    onOpenChange,
    schema,
    onConfirm,
    onCancel
}: SchemaUpdateModalProps) {
    if (!schema) return null

    const newTables = schema.tables.filter(t => t.isNew)
    const tablesWithChanges = schema.tables.filter(t =>
        !t.isNew && t.columns.some(c => c.isNew || c.isModified)
    )

    const totalNewColumns = schema.tables.reduce(
        (sum, table) => sum + table.columns.filter(c => c.isNew).length,
        0
    )
    const totalModifiedColumns = schema.tables.reduce(
        (sum, table) => sum + table.columns.filter(c => c.isModified).length,
        0
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle>Schema Update Available</DialogTitle>
                    <DialogDescription>
                        The following changes were detected in your database schema. Review and confirm to apply.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[50vh] pr-4">
                    <div className="space-y-4">
                        {/* Summary */}
                        <div className="flex items-start gap-2 p-4 bg-muted rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                            <div className="space-y-1">
                                <p className="font-semibold">Summary of Changes</p>
                                <ul className="text-sm text-muted-foreground space-y-1">
                                    {newTables.length > 0 && (
                                        <li>• {newTables.length} new table{newTables.length > 1 ? 's' : ''}</li>
                                    )}
                                    {totalNewColumns > 0 && (
                                        <li>• {totalNewColumns} new column{totalNewColumns > 1 ? 's' : ''}</li>
                                    )}
                                    {totalModifiedColumns > 0 && (
                                        <li>• {totalModifiedColumns} modified column{totalModifiedColumns > 1 ? 's' : ''}</li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* New Tables */}
                        {newTables.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm">New Tables</h4>
                                {newTables.map(table => (
                                    <div key={table.name} className="border-l-4 border-l-red-500 pl-3 py-2 bg-red-50 dark:bg-red-950/20 rounded">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{table.name}</span>
                                            <Badge variant="destructive" className="bg-red-500">NEW</Badge>
                                            <span className="text-sm text-muted-foreground">
                                                ({table.columns.length} columns)
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Tables with Changes */}
                        {tablesWithChanges.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="font-semibold text-sm">Modified Tables</h4>
                                {tablesWithChanges.map(table => {
                                    const newCols = table.columns.filter(c => c.isNew)
                                    const modifiedCols = table.columns.filter(c => c.isModified)

                                    return (
                                        <div key={table.name} className="border rounded-lg p-3 space-y-2">
                                            <div className="font-medium">{table.name}</div>

                                            {newCols.length > 0 && (
                                                <div className="space-y-1">
                                                    <p className="text-xs text-muted-foreground font-semibold">New Columns:</p>
                                                    <div className="space-y-1">
                                                        {newCols.map(col => (
                                                            <div key={col.name} className="flex items-center gap-2 text-sm pl-3 border-l-2 border-l-red-500 bg-red-50 dark:bg-red-950/20 py-1 rounded">
                                                                <span>{col.name}</span>
                                                                <Badge variant="outline" className="text-xs">{col.type}</Badge>
                                                                <Badge variant="destructive" className="text-xs bg-red-500">NEW</Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {modifiedCols.length > 0 && (
                                                <div className="space-y-1">
                                                    <p className="text-xs text-muted-foreground font-semibold">Modified Columns:</p>
                                                    <div className="space-y-1">
                                                        {modifiedCols.map(col => (
                                                            <div key={col.name} className="flex items-center gap-2 text-sm pl-3 border-l-2 border-l-red-500 bg-red-50 dark:bg-red-950/20 py-1 rounded">
                                                                <span>{col.name}</span>
                                                                <Badge variant="outline" className="text-xs">{col.type}</Badge>
                                                                <Badge variant="destructive" className="text-xs bg-red-500">MODIFIED</Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button onClick={onConfirm}>
                        Apply Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
