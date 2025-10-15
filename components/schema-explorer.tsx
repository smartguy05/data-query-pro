"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfirmationModal } from "@/components/ui/confirmation-modal"
import { SchemaUpdateModal } from "@/components/ui/schema-update-modal"
import {
  Database,
  TableIcon,
  Key,
  Link,
  Edit3,
  Save,
  X,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash,
  Eye,
  EyeOff
} from "lucide-react"
import {useDatabaseOptions} from "@/lib/database-connection-options";
import { useToast } from "@/hooks/use-toast";
import { compareSchemas, hasSchemaChanges, getChangeSummary } from "@/utils/compare-schemas";

export function SchemaExplorer() {
  const connectionInformation = useDatabaseOptions();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasConnection, setHasConnection] = useState(false);
  const [editingTable, setEditingTable] = useState<string | null>(null);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [tempDescription, setTempDescription] = useState("");
  const [generatingDescriptions, setGeneratingDescriptions] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ tableName: string; columnName: string } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processMessage, setProcessMessage] = useState("");
  const [processId, setProcessId] = useState<string | null>(null);

  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, currentBatch: 0, totalBatches: 0 });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isUpdatingSchema, setIsUpdatingSchema] = useState(false);
  const [showUpdateConfirmation, setShowUpdateConfirmation] = useState(false);
  const [pendingSchemaUpdate, setPendingSchemaUpdate] = useState<Schema | null>(null);
  const [showDiscardAllConfirmation, setShowDiscardAllConfirmation] = useState(false);

  useEffect(() => {
    if (connectionInformation.isInitialized) {
      checkConnectionAndLoadSchema();
    }
  }, [connectionInformation.isInitialized, connectionInformation.currentConnection?.id])

  // Check if schema has unsaved change flags on load
  useEffect(() => {
    if (connectionInformation.currentSchema) {
      const schemaHasChanges = hasSchemaChanges(connectionInformation.currentSchema);
      if (schemaHasChanges && !hasUnsavedChanges) {
        console.log('Schema has change tracking flags - marking as unsaved');
        setHasUnsavedChanges(true);
      }
    }
  }, [connectionInformation.currentSchema])

  // Ensure loading states are correct when schema is loaded
  useEffect(() => {
    if (connectionInformation.currentSchema && connectionInformation.currentSchema.tables && connectionInformation.currentSchema.tables.length > 0) {
      // Schema exists and has tables, make sure we're not in loading state
      if (loading || isProcessing) {
        console.log('Schema loaded, updating loading states');
        setLoading(false);
        setIsProcessing(false);
      }
    }
  }, [connectionInformation.currentSchema])

  useEffect(() => {
    if (processId && isProcessing) {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/schema/status?processId=${processId}`)
          if (response.ok) {
            const status = await response.json()
            setProcessProgress(status.progress)
            setProcessMessage(status.message)

            if (status.status === "completed") {
              const schema: Schema = {
                connectionId: connectionInformation.currentConnection?.id ?? "",
                tables: status.result.schema.tables
              };
              connectionInformation.setSchema(schema);
              // Don't clear loading states here - let the useEffect handle it
              // when it detects the schema is loaded to avoid race conditions
              setError(null)
              clearInterval(pollInterval)

              alert("Schema introspection completed successfully!")
            } else if (status.status === "error") {
              setError(status.error || "Schema introspection failed")
              setIsProcessing(false)
              setLoading(false)
              clearInterval(pollInterval)
            }
          }
        } catch (error) {
          console.error("Error polling status:", error)
        }
      }, 2000) // Poll every 2 seconds

      return () => clearInterval(pollInterval)
    }
  }, [processId, isProcessing]);

  // Navigation guard for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const handleDeleteColumn = (tableName: string, columnName: string) => {
    setDeleteTarget({ tableName, columnName })
    setShowDeleteConfirmation(true)
  }

  const confirmDeleteColumn = () => {
    if (!deleteTarget) return

    try {
      removeColumnFromTable(deleteTarget.tableName, deleteTarget.columnName);
      console.log(`Column ${deleteTarget.columnName} removed successfully`);
    } catch (error) {
      console.error("Error removing column:", error);
      alert("Failed to remove column. Please try again.");
    }

    setDeleteTarget(null);
  }

  const checkConnectionAndLoadSchema = async () => {
    try {
      const connection = connectionInformation.currentConnection;
      console.log("Active connection check:", connection);

      if (!connection) {
        console.log("No active connection found");
        setHasConnection(false);
        setLoading(false);
        return;
      }

      setHasConnection(true)
      const schema = connectionInformation.getSchema();
      if (!!schema) {
        setLoading(false);
        return;
      }

      setIsProcessing(true)
      setLoading(true)
      setProcessProgress(0)
      setProcessMessage("Starting schema introspection...")

      const response = await fetch("/api/schema/start-introspection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ connection }),
      })

      if (response.ok) {
        const data = await response.json()
        setProcessId(data.processId)
        console.log("Background process started:", data.processId)
      } else {
        const errorData = await response.json()
        console.log("API error:", errorData)
        setError(errorData.error || "Failed to start schema introspection")
        setIsProcessing(false)
        setLoading(false)
      }
    } catch (error) {
      console.error("Schema loading error:", error)
      setError("Failed to connect to database")
      setIsProcessing(false)
      setLoading(false)
    }
  }

  const generateAIDescriptions = async () => {
    if (!connectionInformation.currentSchema) return

    const activeConnection = connectionInformation.currentConnection;
    if (!activeConnection) {
      console.log("No active connection found at start of AI generation");
      alert("No database connection found. Please reconnect to your database.");
      return;
    }
    
    if (!activeConnection.description) {
      alert("A description for the database must be set before table and column descriptions can be generated.");
      return;
    }

    const databaseDescription = activeConnection.description;

    const tablesNeedingDescriptions = connectionInformation.currentSchema.tables
        .filter((table) => {
          const hasTableDescription = table.description || table.aiDescription;
          const hasAllColumnDescriptions = table.columns.every((col) => col.description || col.aiDescription);
          const isHidden = table.hidden;
          return (!hasTableDescription || !hasAllColumnDescriptions) && !isHidden;
        });

    if (tablesNeedingDescriptions.length === 0) {
      alert("All tables already have AI descriptions!");
      return;
    }

    console.log(
      `Processing ${tablesNeedingDescriptions.length} tables (${connectionInformation.currentSchema.tables.length - tablesNeedingDescriptions.length} already have descriptions)`,
    )

    setGeneratingDescriptions(true)
    setBatchProgress({ current: 0, total: tablesNeedingDescriptions.length, currentBatch: 0, totalBatches: 0 })

    try {
      // Process tables in batches of 10
      const batchSize = 10
      const tableBatches = []
      for (let i = 0; i < tablesNeedingDescriptions.length; i += batchSize) {
        tableBatches.push(tablesNeedingDescriptions.slice(i, i + batchSize))
      }

      setBatchProgress((prev) => ({ ...prev, totalBatches: tableBatches.length }))
      const updatedSchema = { ...connectionInformation.currentSchema }

      for (let batchIndex = 0; batchIndex < tableBatches.length; batchIndex++) {
        console.log(`Processing batch ${batchIndex + 1}/${tableBatches.length}`)

        setBatchProgress((prev) => ({
          ...prev,
          currentBatch: batchIndex + 1,
          current: batchIndex * batchSize,
        }))

        const batchSchema = {
          tables: tableBatches[batchIndex],
        }

        try {
          const response = await fetch("/api/schema/generate-descriptions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              schema: batchSchema,
              databaseDescription,
              batchInfo: {
                current: batchIndex + 1,
                total: tableBatches.length,
                tableNames: tableBatches[batchIndex].map((t) => t.name),
              },
            }),
          })

          if (response.ok) {
            const data = await response.json()
            console.log(`Batch ${batchIndex + 1} completed successfully`)

            // Update the schema with the batch results
            data.schema.tables.forEach((updatedTable: any) => {
              const tableIndex = updatedSchema.tables.findIndex((t) => t.name === updatedTable.name)
              if (tableIndex !== -1) {
                updatedSchema.tables[tableIndex] = updatedTable
              }
            })

            // Update the UI with progress
            connectionInformation.setSchema(updatedSchema);
            setBatchProgress((prev) => ({
              ...prev,
              current: (batchIndex + 1) * batchSize,
            }));
          } else {
            const errorText = await response.text();
            console.error(`Failed to process batch ${batchIndex + 1}:`, errorText);
            throw new Error(`Batch ${batchIndex + 1} failed: ${response.status} ${response.statusText}`);
          }
        } catch (batchError) {
          console.error(`Error processing batch ${batchIndex + 1}:`, batchError);
          alert(`Failed to process batch ${batchIndex + 1}. Check console for details.`);
          break;
        }

        // Small delay between batches to prevent rate limiting
        if (batchIndex < tableBatches.length - 1) {
          console.log(`Waiting 1 second before next batch...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      setBatchProgress((prev) => ({ ...prev, current: tablesNeedingDescriptions.length }))

      const skippedCount = connectionInformation.currentSchema.tables.length - tablesNeedingDescriptions.length
      const message =
        skippedCount > 0
          ? `AI descriptions generated for ${tablesNeedingDescriptions.length} tables (${skippedCount} already had descriptions)`
          : `AI descriptions generated for all ${tablesNeedingDescriptions.length} tables`

      console.log(`AI generation completed: ${message}`)
      alert(message)
    } catch (error) {
      console.error("Failed to generate descriptions:", error)
      alert(`Failed to generate AI descriptions: ${error}`)
    } finally {
      setGeneratingDescriptions(false)
      setBatchProgress({ current: 0, total: 0, currentBatch: 0, totalBatches: 0 })
    }
  }

  const removeColumnFromTable = (tableName: string, columnName: string) => {
    if (!connectionInformation.currentSchema) return

    const schemaData = connectionInformation.getSchema();

    if (!schemaData) {
      throw new Error("No schema data found! Be sure to parse database schema before trying to upload.");
    }

    const table = schemaData.tables.find((table) => table.name === tableName);
    if (!table) {
      throw new Error("No table found for schema data!");
    }
    const index = table.columns.findIndex((t) => t.name === columnName);
    if (index < 0) {
      throw new Error("No column found for schema data!");
    }

    table.columns.splice(index, 1);

    connectionInformation.setSchema(schemaData);
    setEditingTable(null)
    setEditingColumn(null)
    setTempDescription("")
    setHasUnsavedChanges(true);
  }

  const saveDescription = (tableName: string, columnName?: string, description?: string) => {
    if (!connectionInformation.currentSchema) return

    const schemaData = connectionInformation.getSchema();

    if (!schemaData) {
      throw new Error("No schema data found! Be sure to parse database schema before trying to upload.");
    }

    const table = schemaData.tables.find((table) => table.name === tableName);
    if (!table) {
      throw new Error("No table found for schema data!");
    }
    if (!!columnName) {
      const column = table.columns.find((column) => column.name === columnName);
      if (!column) {
        throw new Error("No column found for schema data!");
      }

      column.description = description;
    } else {
      table.description = description;
    }
    console.log("Updating description:", { tableName, columnName, description });

    connectionInformation.setSchema(schemaData);
    setEditingTable(null)
    setEditingColumn(null)
    setTempDescription("")
    setHasUnsavedChanges(true);
  }

  const startEditing = (tableName: string, columnName?: string, currentDescription?: string) => {
    setEditingTable(tableName)
    setEditingColumn(columnName || null)
    setTempDescription(currentDescription || "")
  }

  const cancelEditing = () => {
    setEditingTable(null)
    setEditingColumn(null)
    setTempDescription("")
  }

  const toggleTableExpansion = (tableName: string) => {
    const newExpanded = new Set(expandedTables)
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName)
    } else {
      newExpanded.add(tableName)
    }
    setExpandedTables(newExpanded)
  }

  const toggleTableVisibility = (tableName: string) => {
    if (!connectionInformation.currentSchema) return

    const updatedSchema = { ...connectionInformation.currentSchema }
    const table = updatedSchema.tables.find((t) => t.name === tableName)

    if (table) {
      table.hidden = !table.hidden;
    }

    connectionInformation.setSchema(updatedSchema);
    setHasUnsavedChanges(true);
  }

  const toggleColumnVisibility = (tableName: string, columnName: string) => {
    if (!connectionInformation.currentSchema) return

    const updatedSchema = { ...connectionInformation.currentSchema }
    const table = updatedSchema.tables.find((t) => t.name === tableName)

    if (table) {
      const column = table.columns.find((c) => c.name === columnName)
      if (column) {
        column.hidden = !column.hidden
      }
    }

    connectionInformation.setSchema(updatedSchema);
    setHasUnsavedChanges(true);
  }

  const saveChangesToOpenAI = async () => {
    if (!connectionInformation.currentSchema) return;

    const connection = connectionInformation.currentConnection;
    if (!connection) {
      alert("No connection found!");
      return;
    }

    setIsSaving(true);

    try {
      // Capture existing IDs BEFORE clearing them
      const existingFileId = connection.schemaFileId;
      const existingVectorStoreId = connection.vectorStoreId;

      const schemaData = connectionInformation.getSchema();
      if (!schemaData) {
        throw new Error("No schema data found!");
      }

      // Clean change tracking flags before saving
      schemaData.tables.forEach(table => {
        delete table.isNew;
        table.columns.forEach(column => {
          delete column.isNew;
          delete column.isModified;
        });
      });

      // Update schema with cleaned flags
      connectionInformation.setSchema(schemaData);

      const result = await fetch("/api/schema/upload-schema", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: schemaData,
          existingFileId,
          existingVectorStoreId
        }),
      });

      if (result.ok) {
        const ids = await result.json();
        connection.vectorStoreId = ids.vectorStoreId;
        connection.schemaFileId = ids.fileId;
        connectionInformation.updateConnection(connection);
        setHasUnsavedChanges(false);
        toast({
          title: "Schema saved successfully",
          description: "Your schema changes have been uploaded to OpenAI",
        });
      } else {
        throw new Error("Failed to upload schema");
      }
    } catch (error) {
      console.error("Failed to upload schema:", error);
      toast({
        variant: "destructive",
        title: "Failed to save changes",
        description: "Please try again. Check the console for more details.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const updateSchemaFromDatabase = async () => {
    if (!connectionInformation.currentSchema) return;

    const connection = connectionInformation.currentConnection;
    if (!connection) {
      alert("No connection found!");
      return;
    }

    setIsUpdatingSchema(true);

    try {
      // Fetch fresh schema from database
      const response = await fetch("/api/schema/introspect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ connection }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch schema from database");
      }

      const data = await response.json();
      const freshSchema: Schema = {
        connectionId: connectionInformation.currentConnection?.id ?? "",
        tables: data.schema.tables
      };

      // Compare schemas and mark changes
      const comparedSchema = compareSchemas(connectionInformation.currentSchema, freshSchema);

      // Check if there are any changes
      if (!hasSchemaChanges(comparedSchema)) {
        toast({
          title: "Schema is up to date",
          description: "No changes detected in the database schema",
        });
        setIsUpdatingSchema(false);
        return;
      }

      // Show confirmation modal with changes
      setPendingSchemaUpdate(comparedSchema);
      setShowUpdateConfirmation(true);
    } catch (error) {
      console.error("Failed to update schema:", error);
      toast({
        variant: "destructive",
        title: "Failed to update schema",
        description: "Could not fetch schema from database. Check the console for details.",
      });
    } finally {
      setIsUpdatingSchema(false);
    }
  }

  const confirmSchemaUpdate = () => {
    if (!pendingSchemaUpdate) return;

    // Apply the schema update
    connectionInformation.setSchema(pendingSchemaUpdate);
    setHasUnsavedChanges(true);

    const summary = getChangeSummary(pendingSchemaUpdate);
    toast({
      title: "Schema updated",
      description: `${summary.newTables} new tables, ${summary.newColumns} new columns, ${summary.modifiedColumns} modified columns`,
    });

    setPendingSchemaUpdate(null);
    setShowUpdateConfirmation(false);
  }

  const cancelSchemaUpdate = () => {
    setPendingSchemaUpdate(null);
    setShowUpdateConfirmation(false);
  }

  const discardAllChanges = () => {
    if (!connectionInformation.currentSchema) return;

    const schemaData = connectionInformation.getSchema();
    if (!schemaData) return;

    // Remove all change tracking flags
    schemaData.tables.forEach(table => {
      delete table.isNew;
      table.columns.forEach(column => {
        delete column.isNew;
        delete column.isModified;
      });
    });

    connectionInformation.setSchema(schemaData);
    setHasUnsavedChanges(false);

    toast({
      title: "Changes discarded",
      description: "All schema changes have been discarded",
    });
  }

  const discardTableChanges = (tableName: string) => {
    if (!connectionInformation.currentSchema) return;

    const schemaData = connectionInformation.getSchema();
    if (!schemaData) return;

    const table = schemaData.tables.find(t => t.name === tableName);
    if (!table) return;

    // Remove change flags from this table and its columns
    delete table.isNew;
    table.columns.forEach(column => {
      delete column.isNew;
      delete column.isModified;
    });

    connectionInformation.setSchema(schemaData);

    // Check if there are still other changes
    const stillHasChanges = hasSchemaChanges(schemaData);
    setHasUnsavedChanges(stillHasChanges);

    toast({
      title: "Table changes discarded",
      description: `Changes to table "${tableName}" have been discarded`,
    });
  }

  const discardColumnChange = (tableName: string, columnName: string) => {
    if (!connectionInformation.currentSchema) return;

    const schemaData = connectionInformation.getSchema();
    if (!schemaData) return;

    const table = schemaData.tables.find(t => t.name === tableName);
    if (!table) return;

    const column = table.columns.find(c => c.name === columnName);
    if (!column) return;

    // Remove change flags from this column
    delete column.isNew;
    delete column.isModified;

    connectionInformation.setSchema(schemaData);

    // Check if there are still other changes
    const stillHasChanges = hasSchemaChanges(schemaData);
    setHasUnsavedChanges(stillHasChanges);

    toast({
      title: "Column change discarded",
      description: `Changes to column "${columnName}" have been discarded`,
    });
  }

  if (loading || isProcessing) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="w-8 h-8 animate-spin text-accent" />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">
                {isProcessing ? "Processing Schema in Background" : "Loading Schema"}
              </h3>
              <p className="text-sm text-muted-foreground">{processMessage}</p>
              {isProcessing && (
                <div className="w-full max-w-md mx-auto">
                  <div className="bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-accent h-full transition-all duration-300 ease-out"
                      style={{ width: `${processProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{processProgress}% complete</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                This may take several minutes for large databases. You'll be notified when complete.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!hasConnection) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No database connection found. Please connect to a database first.</AlertDescription>
      </Alert>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button variant="outline" size="sm" className="ml-2 bg-transparent" onClick={checkConnectionAndLoadSchema}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!connectionInformation.currentSchema || !connectionInformation.currentSchema.tables || connectionInformation.currentSchema.tables.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No tables found in the database schema.
          <Button
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={checkConnectionAndLoadSchema}
          >
            Reload Schema
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-accent" />
          <span className="text-lg font-semibold">
            {connectionInformation.currentSchema.tables.length} Tables Found
            {connectionInformation.currentSchema.tables.filter((t) => t.hidden).length > 0 && (
              <span className="text-sm text-muted-foreground ml-2">
                ({connectionInformation.currentSchema.tables.filter((t) => t.hidden).length} hidden from queries)
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={updateSchemaFromDatabase}
            disabled={isUpdatingSchema}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isUpdatingSchema ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Checking for updates...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Update Schema
              </>
            )}
          </Button>
          {hasUnsavedChanges && (
            <>
              <Button
                onClick={saveChangesToOpenAI}
                disabled={isSaving}
                variant="default"
                className="flex items-center gap-2 bg-accent"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save to OpenAI
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowDiscardAllConfirmation(true)}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Discard All Changes
              </Button>
            </>
          )}
          <Button onClick={generateAIDescriptions} disabled={generatingDescriptions} className="flex items-center gap-2">
            {generatingDescriptions ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                Generating... ({batchProgress.currentBatch}/{batchProgress.totalBatches} batches, {batchProgress.current}/
                {batchProgress.total} tables)
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate AI Descriptions
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tables" className="w-full">
        <TabsList>
          <TabsTrigger value="tables">Tables Overview</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="space-y-4">
          {connectionInformation.currentSchema.tables.map((table) => {
            const hasChanges = table.isNew || table.columns.some(c => c.isNew || c.isModified);

            return (
            <Card
              key={table.name}
              className={`${table.hidden ? "opacity-60 border-dashed" : ""} ${hasChanges ? "border-2 border-red-500" : ""}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleTableExpansion(table.name)}
                      className="p-1 h-auto"
                    >
                      {expandedTables.has(table.name) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                    <TableIcon className="w-5 h-5 text-accent" />
                    <CardTitle className="text-xl">{table.name}</CardTitle>
                    {table.isNew && (
                      <Badge variant="destructive" className="bg-red-500">
                        NEW
                      </Badge>
                    )}
                    <Badge variant="secondary">{table.columns.length} columns</Badge>
                    {table.columns.filter((c) => c.hidden).length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {table.columns.filter((c) => c.hidden).length} hidden
                      </Badge>
                    )}
                    {table.hidden && (
                      <Badge variant="outline" className="text-xs">
                        Table Hidden from Queries
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasChanges && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => discardTableChanges(table.name)}
                        title="Discard all changes to this table"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Discard Changes
                      </Button>
                    )}
                    <Button
                      variant={table.hidden ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleTableVisibility(table.name)}
                      title={table.hidden ? "Show in queries" : "Hide from queries"}
                    >
                      {table.hidden ? "Show" : "Hide"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Edit Table description"
                      onClick={() => startEditing(table.name, undefined, table.description || table.aiDescription)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {editingTable === table.name && !editingColumn ? (
                  <div className="space-y-2">
                    <Textarea
                      value={tempDescription}
                      onChange={(e) => setTempDescription(e.target.value)}
                      placeholder="Add a description for this table..."
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveDescription(table.name, undefined, tempDescription)}>
                        <Save className="w-4 h-4 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing}>
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <CardDescription>
                    {table.description || table.aiDescription || "No description available"}
                    {table.aiDescription && !table.description && (
                      <Badge variant="outline" className="ml-2">
                        AI Generated
                      </Badge>
                    )}
                  </CardDescription>
                )}
              </CardHeader>

              {expandedTables.has(table.name) && (
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Column</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Constraints</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {table.columns.map((column, columnIndex) => (
                        <TableRow
                          key={`${table.name}-${column.name}-${columnIndex}`}
                          className={`${column.hidden ? "opacity-50" : ""} ${column.isNew || column.isModified ? "border-l-4 border-l-red-500" : ""}`}
                        >
                          <TableCell className="font-medium">
                            {column.name}
                            {column.isNew && (
                              <Badge variant="destructive" className="ml-2 text-xs bg-red-500">
                                NEW
                              </Badge>
                            )}
                            {column.isModified && (
                              <Badge variant="destructive" className="ml-2 text-xs bg-red-500">
                                MODIFIED
                              </Badge>
                            )}
                            {column.hidden && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Hidden
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{column.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {column.primary_key && (
                                <Badge variant="default" className="text-xs">
                                  <Key className="w-3 h-3 mr-1" />
                                  PK
                                </Badge>
                              )}
                              {column.foreign_key && (
                                <Badge variant="secondary" className="text-xs">
                                  <Link className="w-3 h-3 mr-1" />
                                  FK
                                </Badge>
                              )}
                              {!column.nullable && (
                                <Badge variant="outline" className="text-xs">
                                  NOT NULL
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {editingTable === table.name && editingColumn === column.name ? (
                              <div className="space-y-2">
                                <Input
                                  value={tempDescription}
                                  onChange={(e) => setTempDescription(e.target.value)}
                                  placeholder="Add column description..."
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => saveDescription(table.name, column.name, tempDescription)}>
                                    <Save className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={cancelEditing}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  {column.description || column.aiDescription || "No description"}
                                </span>
                                {column.aiDescription && !column.description && (
                                  <Badge variant="outline" className="text-xs">
                                    AI
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {(column.isNew || column.isModified) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Discard change to this column"
                                  onClick={() => discardColumnChange(table.name, column.name)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                title={column.hidden ? "Show in queries" : "Hide from queries"}
                                onClick={() => toggleColumnVisibility(table.name, column.name)}
                              >
                                {column.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Edit this Column's description"
                                onClick={() => startEditing(table.name, column.name, column.description || column.aiDescription)}
                              >
                                <Edit3 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Remove the current Column from this Table"
                                onClick={() => handleDeleteColumn(table.name, column.name)}
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="relationships">
          <Card>
            <CardHeader>
              <CardTitle>Table Relationships</CardTitle>
              <CardDescription>Foreign key relationships between tables</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {connectionInformation.currentSchema.tables.map((table) => {
                  const foreignKeys = table.columns.filter((col) => col.foreign_key)
                  if (foreignKeys.length === 0) return null

                  return (
                    <div key={table.name} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">{table.name}</h4>
                      <div className="space-y-2">
                        {foreignKeys.map((fk, fkIndex) => (
                          <div
                            key={`${table.name}-${fk.name}-fk-${fkIndex}`}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Badge variant="outline">{fk.name}</Badge>
                            <span>→</span>
                            <Badge variant="secondary">{fk.foreign_key}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Floating Save Button */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-8 right-8 z-50">
          <Card className="shadow-lg border-2 border-accent">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-accent" />
                  <span className="font-semibold">Unsaved Changes</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You have unsaved changes to your schema
                </p>
                <Button
                  onClick={saveChangesToOpenAI}
                  disabled={isSaving}
                  className="w-full"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save to OpenAI
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setShowDiscardAllConfirmation(true)}
                  variant="destructive"
                  className="w-full"
                >
                  <X className="w-4 h-4 mr-2" />
                  Discard All Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmationModal
          open={showDeleteConfirmation}
          onOpenChange={setShowDeleteConfirmation}
          title="Delete Column"
          description={`Are you sure you want to delete the column "${deleteTarget?.columnName}" from table "${deleteTarget?.tableName}"? This action cannot be undone and will remove this column from future Query Generations.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={confirmDeleteColumn}
      />

      <SchemaUpdateModal
          open={showUpdateConfirmation}
          onOpenChange={setShowUpdateConfirmation}
          schema={pendingSchemaUpdate}
          onConfirm={confirmSchemaUpdate}
          onCancel={cancelSchemaUpdate}
      />

      <ConfirmationModal
          open={showDiscardAllConfirmation}
          onOpenChange={setShowDiscardAllConfirmation}
          title="Discard All Changes"
          description="Are you sure you want to discard all schema changes? This will remove all NEW and MODIFIED flags from your schema. This action cannot be undone."
          confirmText="Discard All"
          cancelText="Cancel"
          variant="destructive"
          onConfirm={discardAllChanges}
      />
    </div>
)
}
