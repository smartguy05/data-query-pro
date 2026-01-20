"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Database, CheckCircle, Loader2, Plus, Trash2, Download, Upload, Edit, AlertCircle, Copy } from "lucide-react"
import {useDatabaseOptions} from "@/lib/database-connection-options";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { DatabaseType } from "@/lib/database"

interface ConnectionFormData {
  type: string
  name: string
  host: string
  port: string
  database: string
  username: string
  password: string
  filepath: string
  description: string
}

export default function DatabasePage() {
  const connectionInformation = useDatabaseOptions();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [uploadingSchemaId, setUploadingSchemaId] = useState<string | null>(null);

  const savedConnections = connectionInformation.connections;
  const connectionStatus = connectionInformation.connectionStatus;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ConnectionFormData>({
    defaultValues: {
      type: "",
      name: "",
      host: "",
      port: "",
      database: "",
      username: "",
      password: "",
      filepath: "",
      description: "",
    },
  })

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    watch: watchEdit,
    setValue: setValueEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit },
  } = useForm<ConnectionFormData>({
    defaultValues: {
      type: "",
      name: "",
      host: "",
      port: "",
      database: "",
      username: "",
      password: "",
      filepath: "",
      description: "",
    },
  })

  const selectedType = watch("type")
  const selectedEditType = watchEdit("type")

  // Check if the selected type is SQLite (file-based)
  const isSQLite = selectedType === "sqlite"
  const isEditSQLite = selectedEditType === "sqlite"

  useEffect(() => {
    const defaultPorts: Record<string, string> = {
      postgresql: "5432",
      mysql: "3306",
      sqlserver: "1433",
      sqlite: "",
    }

    if (selectedType && defaultPorts[selectedType]) {
      setValue("port", defaultPorts[selectedType])
    }
  }, [selectedType, setValue])

  useEffect(() => {
    const defaultPorts: Record<string, string> = {
      postgresql: "5432",
      mysql: "3306",
      sqlserver: "1433",
      sqlite: "",
    }

    if (selectedEditType && defaultPorts[selectedEditType]) {
      setValueEdit("port", defaultPorts[selectedEditType])
    }
  }, [selectedEditType, setValueEdit])

  const handleConnect = async (data: ConnectionFormData) => {
    // Validate based on database type
    if (!data.type || !data.name) {
      connectionInformation.setConnectionStatus("error")
      setConnectionError("Database type and name are required")
      return
    }

    if (data.type === "sqlite") {
      if (!data.filepath) {
        connectionInformation.setConnectionStatus("error")
        setConnectionError("File path is required for SQLite")
        return
      }
    } else {
      if (!data.host || !data.database || !data.username) {
        connectionInformation.setConnectionStatus("error")
        setConnectionError("Host, database, and username are required")
        return
      }
    }

    setIsConnecting(true)
    setConnectionError(null)
    connectionInformation.setConnectionStatus("idle")

    try {
      // Test the connection using the new API
      const testResponse = await fetch("/api/connection/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection: {
            type: data.type,
            host: data.host,
            port: data.port,
            database: data.database,
            username: data.username,
            password: data.password,
            filepath: data.filepath,
          },
        }),
      })

      const testResult = await testResponse.json()

      if (!testResult.success) {
        throw new Error(testResult.error || "Connection test failed")
      }

      // Create new connection object
      const newConnection: DatabaseConnection = {
        id: Date.now().toString(),
        name: data.name,
        type: data.type as DatabaseType,
        host: data.host,
        port: data.port,
        database: data.database,
        username: data.username,
        password: data.password,
        filepath: data.filepath || undefined,
        description: data.description,
        status: "connected",
        createdAt: new Date().toISOString(),
        source: "local",
      };

      connectionInformation.addConnection(newConnection);
      connectionInformation.setCurrentConnection(newConnection);
      connectionInformation.setConnectionStatus("success")
      reset()
    } catch (error) {
      console.error("Connection failed:", error)
      connectionInformation.setConnectionStatus("error")
      setConnectionError(error instanceof Error ? error.message : "Connection failed")
    } finally {
      setIsConnecting(false)
    }
  }

  const exportData = async () => {
    setIsExporting(true)
    try {
      const savedReports = JSON.parse(localStorage.getItem("saved_reports") || "[]")

      const exportData = {
        version: "1.1",
        exportDate: new Date().toISOString(),
        databaseConnections: connectionInformation.connections,
        currentDbConnection: connectionInformation.currentConnection,
        schemaData: {} as Record<string, Schema>,
        savedReports: savedReports,
      };

      for (let i = 0; i < connectionInformation.connections.length; i++) {
        const schemaData = connectionInformation.getSchema(connectionInformation.connections[i].id);
        if (!!schemaData) {
          exportData.schemaData[connectionInformation.connections[i].id] = schemaData;
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `database-export-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export failed:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportStatus("idle")

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string)

        if (!importData.version || !importData.databaseConnections) {
          throw new Error("Invalid export file format")
        }

        if (importData.databaseConnections && Array.isArray(importData.databaseConnections)) {
          connectionInformation.importConnections(importData.databaseConnections);
        }

        if (importData.currentDbConnection) {
          connectionInformation.setCurrentConnection(importData.currentDbConnection);
        }

        if (importData.schemaData && typeof importData.schemaData === "object") {
          Object.entries(importData.schemaData).forEach(([connectionId, schema]) => {
            connectionInformation.setSchema(schema as Schema);
          })
        }

        if (importData.savedReports && Array.isArray(importData.savedReports)) {
          const existingReports = JSON.parse(localStorage.getItem("saved_reports") || "[]")
          const existingIds = new Set(existingReports.map((r: { id: string }) => r.id))
          const validConnectionIds = new Set(importData.databaseConnections.map((c: { id: string }) => c.id))

          const newReports = importData.savedReports.filter((report: { id: string; connectionId: string }) =>
            !existingIds.has(report.id) && validConnectionIds.has(report.connectionId)
          )

          const mergedReports = [...existingReports, ...newReports]
          localStorage.setItem("saved_reports", JSON.stringify(mergedReports))
        }

        setImportStatus("success")
        setTimeout(() => setImportStatus("idle"), 3000)
      } catch (error) {
        console.error("Import failed:", error)
        setImportStatus("error")
        setTimeout(() => setImportStatus("idle"), 3000)
      } finally {
        setIsImporting(false)
      }
    }

    reader.readAsText(file)
    event.target.value = ""
  }

  const uploadSchema = async (connection: DatabaseConnection) => {
    let schemaData = connectionInformation.getSchema(connection.id);

    if (!schemaData) {
      alert("No schema data found! Be sure to introspect the database schema before trying to upload.");
      return;
    }

    setUploadingSchemaId(connection.id);

    try {
      const response = await fetch("/api/schema/upload-schema", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: schemaData
        }),
      });

      if (response.ok) {
        const data = await response.json();
        connection.schemaFileId = data.fileId;
        connection.vectorStoreId = data.vectorStoreId;
        connectionInformation.updateConnection(connection);
        alert("Schema uploaded successfully!");
      } else {
        const errorText = await response.text();
        console.error(`Failed to upload schema file`, errorText);
        throw new Error(`Failed to upload schema file: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      alert(error);
    } finally {
      setUploadingSchemaId(null);
    }
  };

  const deleteConnection = (id: string) => {
    connectionInformation.deleteConnection(id);
  }

  const handleDuplicateConnection = (connection: DatabaseConnection) => {
    const isServerConnection = connection.source === "server";
    const newConnection = connectionInformation.duplicateConnection(connection.id);
    if (newConnection) {
      if (isServerConnection) {
        alert(`Connection "${newConnection.name}" created successfully!\n\nSince you duplicated a server connection, you'll need to:\n1. Edit the connection and enter the database credentials\n2. Upload the schema to OpenAI to enable AI queries`);
      } else {
        alert(`Connection "${newConnection.name}" created successfully! Remember to upload the schema to OpenAI to enable AI queries.`);
      }
    }
  }

  const setCurrentConnection = (connection: DatabaseConnection) => {
    connectionInformation.setCurrentConnection(connection);
  }

  const openEditDialog = (connection: DatabaseConnection) => {
    setEditingConnection(connection);
    setUpdateError(null);
    resetEdit({
      type: connection.type,
      name: connection.name,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password: connection.password,
      filepath: connection.filepath || "",
      description: connection.description || "",
    });
    setIsEditDialogOpen(true);
  }

  const handleUpdateConnection = async (data: ConnectionFormData) => {
    if (!editingConnection) return;

    // Validate based on database type
    if (!data.type || !data.name) {
      setUpdateError("Database type and name are required")
      return
    }

    if (data.type === "sqlite") {
      if (!data.filepath) {
        setUpdateError("File path is required for SQLite")
        return
      }
    } else {
      if (!data.host || !data.database || !data.username) {
        setUpdateError("Host, database, and username are required")
        return
      }
    }

    setIsUpdating(true);
    setUpdateError(null);

    try {
      // Test the connection
      const testResponse = await fetch("/api/connection/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connection: {
            type: data.type,
            host: data.host,
            port: data.port,
            database: data.database,
            username: data.username,
            password: data.password,
            filepath: data.filepath,
          },
        }),
      })

      const testResult = await testResponse.json()

      if (!testResult.success) {
        throw new Error(testResult.error || "Connection test failed")
      }

      const updatedConnection: DatabaseConnection = {
        ...editingConnection,
        name: data.name,
        type: data.type as DatabaseType,
        host: data.host,
        port: data.port,
        database: data.database,
        username: data.username,
        password: data.password,
        filepath: data.filepath || undefined,
        description: data.description,
      };

      connectionInformation.updateConnection(updatedConnection);
      setIsEditDialogOpen(false);
      setEditingConnection(null);
      resetEdit();
    } catch (error) {
      console.error("Update failed:", error);
      setUpdateError(error instanceof Error ? error.message : "Update failed")
    } finally {
      setIsUpdating(false);
    }
  }

  const getConnectionDisplayInfo = (connection: DatabaseConnection) => {
    // For server connections, don't show obscured connection details
    if (connection.source === "server") {
      return `${connection.type.toUpperCase()} • Credentials managed by server`
    }
    if (connection.type === "sqlite") {
      return `SQLite • ${connection.filepath || "No file path"}`
    }
    return `${connection.type.toUpperCase()} • ${connection.host}:${connection.port}/${connection.database}`
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Database Connections</h1>
          <p className="text-muted-foreground">Connect to your data sources for analysis and reporting</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>
              Export your database connections, schema data, and AI descriptions to transfer between machines
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                onClick={exportData}
                disabled={isExporting}
                variant="outline"
                className="flex items-center gap-2 bg-transparent"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export Data
              </Button>

              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={importData}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isImporting}
                />
                <Button disabled={isImporting} variant="outline" className="flex items-center gap-2 bg-transparent">
                  {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Import Data
                </Button>
              </div>
            </div>

            {importStatus === "success" && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg mt-4">
                <CheckCircle className="h-5 w-5" />
                <span>Data imported successfully! Refresh the page to see all changes.</span>
              </div>
            )}

            {importStatus === "error" && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg mt-4">
                <span>Import failed. Please check the file format and try again.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue={savedConnections && savedConnections.length > 0 ? "existing" : "connect"} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connect">New Connection</TabsTrigger>
            <TabsTrigger value="existing">Existing Connections ({savedConnections?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="connect">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  Connect Database
                </CardTitle>
                <CardDescription>Add a new database connection for querying and analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(handleConnect)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="db-type">Database Type *</Label>
                      <Select onValueChange={(value) => setValue("type", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select database type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="postgresql">PostgreSQL</SelectItem>
                          <SelectItem value="mysql">MySQL</SelectItem>
                          <SelectItem value="sqlserver">SQL Server</SelectItem>
                          <SelectItem value="sqlite">SQLite</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.type && <p className="text-sm text-red-600">Database type is required</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="connection-name">Connection Name *</Label>
                      <Input
                        {...register("name", { required: "Connection name is required" })}
                        placeholder="Production Database"
                      />
                      {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Database Description</Label>
                    <textarea
                      {...register("description")}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Describe what data this database contains (e.g., 'E-commerce platform with customer orders, product catalog, inventory management, and payment processing')"
                    />
                    <p className="text-xs text-slate-500">
                      This description helps AI generate better table and column descriptions for query generation
                    </p>
                  </div>

                  {/* SQLite-specific field */}
                  {isSQLite && (
                    <div className="space-y-2">
                      <Label htmlFor="filepath">Database File Path *</Label>
                      <Input
                        {...register("filepath", { required: isSQLite ? "File path is required for SQLite" : false })}
                        placeholder="/path/to/database.sqlite"
                      />
                      <p className="text-xs text-slate-500">
                        Enter the absolute path to the SQLite database file on the server
                      </p>
                      {errors.filepath && <p className="text-sm text-red-600">{errors.filepath.message}</p>}
                    </div>
                  )}

                  {/* Server-based database fields */}
                  {!isSQLite && selectedType && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="host">Host *</Label>
                          <Input {...register("host", { required: !isSQLite ? "Host is required" : false })} placeholder="localhost" />
                          {errors.host && <p className="text-sm text-red-600">{errors.host.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="port">Port</Label>
                          <Input {...register("port")} placeholder="5432" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="database">Database Name *</Label>
                        <Input
                          {...register("database", { required: !isSQLite ? "Database name is required" : false })}
                          placeholder="company_db"
                        />
                        {errors.database && <p className="text-sm text-red-600">{errors.database.message}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="username">Username *</Label>
                          <Input {...register("username", { required: !isSQLite ? "Username is required" : false })} placeholder="admin" />
                          {errors.username && <p className="text-sm text-red-600">{errors.username.message}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <Input {...register("password")} type="password" placeholder="••••••••" />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Prompt to select database type */}
                  {!selectedType && (
                    <div className="text-center py-4 text-muted-foreground">
                      Select a database type to see connection options
                    </div>
                  )}

                  <Button type="submit" disabled={isConnecting || !selectedType} className="w-full">
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing Connection...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Connect Database
                      </>
                    )}
                  </Button>

                  {connectionStatus === "success" && (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                      <CheckCircle className="h-5 w-5" />
                      <span>Successfully connected and saved database connection!</span>
                    </div>
                  )}

                  {connectionStatus === "error" && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                      <AlertCircle className="h-5 w-5" />
                      <span>{connectionError || "Failed to connect. Please check your connection details."}</span>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="existing">
            <div className="space-y-4">
              {!savedConnections?.length ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center space-y-2">
                      <Database className="h-12 w-12 text-muted-foreground mx-auto" />
                      <p className="text-muted-foreground">No saved connections yet</p>
                      <p className="text-sm text-muted-foreground">Create your first database connection to get started</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                savedConnections.map((connection) => (
                  <Card key={connection.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                          className={`p-2 rounded-lg flex-shrink-0 ${
                            connection.status === "connected" ? "bg-green-100" : "bg-slate-100"
                          }`}
                        >
                          <Database
                            className={`h-5 w-5 ${
                              connection.status === "connected" ? "text-green-600" : "text-slate-600"
                            }`}
                          />
                        </div>

                        {/* Connection Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{connection.name}</h3>
                            <Badge
                              variant={connection.status === "connected" ? "default" : "secondary"}
                              className={connection.status === "connected" ? "bg-green-100 text-green-700" : ""}
                            >
                              {connection.status === "connected" ? "Active" : "Saved"}
                            </Badge>
                            {connection.source === "server" && (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200"
                              >
                                Server Config
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {getConnectionDisplayInfo(connection)}
                          </p>
                          {connection.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{connection.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Created: {new Date(connection.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {connection.status !== "connected" && (
                            <Button size="sm" variant="outline" onClick={() => setCurrentConnection(connection)}>
                              Use Connection
                            </Button>
                          )}
                          {!connection.schemaFileId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => uploadSchema(connection)}
                              disabled={uploadingSchemaId === connection.id}
                            >
                              {uploadingSchemaId === connection.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload Schema
                                </>
                              )}
                            </Button>
                          ) : (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs whitespace-nowrap">Schema Uploaded</span>
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDuplicateConnection(connection)}
                            title="Duplicate connection"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => connection.source !== "server" && openEditDialog(connection)}
                            disabled={connection.source === "server"}
                            title={connection.source === "server" ? "Server connections cannot be edited" : "Edit connection"}
                          >
                            <Edit className={`h-4 w-4 ${connection.source === "server" ? "text-muted-foreground" : ""}`} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => connection.source !== "server" && deleteConnection(connection.id)}
                            disabled={connection.source === "server"}
                            title={connection.source === "server" ? "Server connections cannot be deleted" : "Delete connection"}
                          >
                            <Trash2 className={`h-4 w-4 ${connection.source === "server" ? "text-muted-foreground" : "text-red-500"}`} />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Connection Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Database Connection</DialogTitle>
              <DialogDescription>
                Update the connection details for your database
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitEdit(handleUpdateConnection)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-db-type">Database Type *</Label>
                  <Select
                    value={watchEdit("type")}
                    onValueChange={(value) => setValueEdit("type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select database type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="postgresql">PostgreSQL</SelectItem>
                      <SelectItem value="mysql">MySQL</SelectItem>
                      <SelectItem value="sqlserver">SQL Server</SelectItem>
                      <SelectItem value="sqlite">SQLite</SelectItem>
                    </SelectContent>
                  </Select>
                  {errorsEdit.type && <p className="text-sm text-red-600">Database type is required</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-connection-name">Connection Name *</Label>
                  <Input
                    {...registerEdit("name", { required: "Connection name is required" })}
                    placeholder="Production Database"
                  />
                  {errorsEdit.name && <p className="text-sm text-red-600">{errorsEdit.name.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Database Description</Label>
                <textarea
                  {...registerEdit("description")}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Describe what data this database contains"
                />
              </div>

              {/* SQLite-specific field */}
              {isEditSQLite && (
                <div className="space-y-2">
                  <Label htmlFor="edit-filepath">Database File Path *</Label>
                  <Input
                    {...registerEdit("filepath", { required: isEditSQLite ? "File path is required for SQLite" : false })}
                    placeholder="/path/to/database.sqlite"
                  />
                  <p className="text-xs text-slate-500">
                    Enter the absolute path to the SQLite database file on the server
                  </p>
                  {errorsEdit.filepath && <p className="text-sm text-red-600">{errorsEdit.filepath.message}</p>}
                </div>
              )}

              {/* Server-based database fields */}
              {!isEditSQLite && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-host">Host *</Label>
                      <Input {...registerEdit("host", { required: !isEditSQLite ? "Host is required" : false })} placeholder="localhost" />
                      {errorsEdit.host && <p className="text-sm text-red-600">{errorsEdit.host.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-port">Port</Label>
                      <Input {...registerEdit("port")} placeholder="5432" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-database">Database Name *</Label>
                    <Input
                      {...registerEdit("database", { required: !isEditSQLite ? "Database name is required" : false })}
                      placeholder="company_db"
                    />
                    {errorsEdit.database && <p className="text-sm text-red-600">{errorsEdit.database.message}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-username">Username *</Label>
                      <Input {...registerEdit("username", { required: !isEditSQLite ? "Username is required" : false })} placeholder="admin" />
                      {errorsEdit.username && <p className="text-sm text-red-600">{errorsEdit.username.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-password">Password</Label>
                      <Input {...registerEdit("password")} type="password" placeholder="••••••••" />
                    </div>
                  </div>
                </>
              )}

              {updateError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="h-5 w-5" />
                  <span>{updateError}</span>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingConnection(null);
                    setUpdateError(null);
                    resetEdit();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing & Updating...
                    </>
                  ) : (
                    "Update Connection"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
