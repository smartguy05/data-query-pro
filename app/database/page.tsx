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
import { Database, CheckCircle, Loader2, Plus, Trash2, Download, Upload, Edit } from "lucide-react"
import {useDatabaseOptions} from "@/lib/database-connection-options";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export default function DatabasePage() {
  const connectionInformation = useDatabaseOptions();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
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
      description: "",
    },
  })

  const selectedType = watch("type")
  const selectedEditType = watchEdit("type")

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
    if (!data.type || !data.name || !data.host || !data.database || !data.username) {
      connectionInformation.setConnectionStatus("error")
      return
    }

    setIsConnecting(true)
    connectionInformation.setConnectionStatus("idle")

    try {
      // Simulate connection test
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Create new connection object
      const newConnection: DatabaseConnection = {
        id: Date.now().toString(),
        name: data.name,
        type: data.type,
        host: data.host,
        port: data.port,
        database: data.database,
        username: data.username,
        password: data.password, // In production, don't store passwords in localStorage
        description: data.description,
        status: "connected",
        createdAt: new Date().toISOString(),
      };

      connectionInformation.addConnection(newConnection);

      // Also save current connection for schema introspection
      connectionInformation.setCurrentConnection(newConnection);

      connectionInformation.setConnectionStatus("success")
      reset() // Clear form after successful connection
    } catch (error) {
      console.error("Connection failed:", error)
      connectionInformation.setConnectionStatus("error")
    } finally {
      setIsConnecting(false)
    }
  }

  const exportData = async () => {
    setIsExporting(true)
    try {
      // Get saved reports from localStorage
      const savedReports = JSON.parse(localStorage.getItem("saved_reports") || "[]")

      const exportData = {
        version: "1.1",
        exportDate: new Date().toISOString(),
        databaseConnections: connectionInformation.connections,
        currentDbConnection: connectionInformation.currentConnection,
        schemaData: {},
        savedReports: savedReports,
      };

      for (let i = 0; i < connectionInformation.connections.length; i++) {
        const schemaData = connectionInformation.getSchema(connectionInformation.connections[i].id);
        if (!!schemaData) {
          (exportData.schemaData as any)[connectionInformation.connections[i].id] = schemaData;
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

        // Validate import data structure
        if (!importData.version || !importData.databaseConnections) {
          throw new Error("Invalid export file format")
        }

        // Import database connections
        if (importData.databaseConnections && Array.isArray(importData.databaseConnections)) {
          connectionInformation.importConnections(importData.databaseConnections);
        }

        // Import current connection
        if (importData.currentDbConnection) {
          connectionInformation.setCurrentConnection(importData.currentDbConnection);
        }

        // Import schema data
        if (importData.schemaData && typeof importData.schemaData === "object") {
          Object.entries(importData.schemaData).forEach(([connectionId, schema]) => {
            // Use the context's setSchema function to properly import each schema
            connectionInformation.setSchema(schema as Schema);
          })
        }

        // Import saved reports
        if (importData.savedReports && Array.isArray(importData.savedReports)) {
          const existingReports = JSON.parse(localStorage.getItem("saved_reports") || "[]")
          const existingIds = new Set(existingReports.map((r: any) => r.id))

          // Get valid connection IDs from imported connections
          const validConnectionIds = new Set(importData.databaseConnections.map((c: any) => c.id))

          // Filter and merge reports - only import reports for valid connections, skip duplicates
          const newReports = importData.savedReports.filter((report: any) =>
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
    event.target.value = "" // Reset file input
  }

  // Upload schema data as a file
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
  
  const setCurrentConnection = (connection: DatabaseConnection) => {
    connectionInformation.setCurrentConnection(connection);
  }

  const openEditDialog = (connection: DatabaseConnection) => {
    setEditingConnection(connection);
    // Populate the edit form with existing connection data
    resetEdit({
      type: connection.type,
      name: connection.name,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password: connection.password,
      description: connection.description || "",
    });
    setIsEditDialogOpen(true);
  }

  const handleUpdateConnection = async (data: ConnectionFormData) => {
    if (!editingConnection) return;

    if (!data.type || !data.name || !data.host || !data.database || !data.username) {
      return;
    }

    setIsUpdating(true);

    try {
      // Simulate connection test
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update the connection object
      const updatedConnection: DatabaseConnection = {
        ...editingConnection,
        name: data.name,
        type: data.type,
        host: data.host,
        port: data.port,
        database: data.database,
        username: data.username,
        password: data.password,
        description: data.description,
      };

      connectionInformation.updateConnection(updatedConnection);
      setIsEditDialogOpen(false);
      setEditingConnection(null);
      resetEdit();
    } catch (error) {
      console.error("Update failed:", error);
    } finally {
      setIsUpdating(false);
    }
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="host">Host *</Label>
                      <Input {...register("host", { required: "Host is required" })} placeholder="localhost" />
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
                      {...register("database", { required: "Database name is required" })}
                      placeholder="company_db"
                    />
                    {errors.database && <p className="text-sm text-red-600">{errors.database.message}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username *</Label>
                      <Input {...register("username", { required: "Username is required" })} placeholder="admin" />
                      {errors.username && <p className="text-sm text-red-600">{errors.username.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input {...register("password")} type="password" placeholder="••••••••" />
                    </div>
                  </div>

                  <Button type="submit" disabled={isConnecting} className="w-full">
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
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
                      <span>Failed to connect. Please check your connection details.</span>
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              connection.status === "connected" ? "bg-green-100" : "bg-slate-100"
                            }`}
                          >
                            <Database
                              className={`h-5 w-5 ${
                                connection.status === "connected" ? "text-green-600" : "text-slate-600"
                              }`}
                            />
                          </div>
                          <div>
                            <h3 className="font-semibold">{connection.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {connection.type.toUpperCase()} • {connection.host}:{connection.port}/
                              {connection.database}
                            </p>
                            {connection.description && (
                              <p className="text-xs text-muted-foreground mt-1 max-w-md truncate">{connection.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Created: {new Date(connection.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={connection.status === "connected" ? "default" : "secondary"}
                            className={connection.status === "connected" ? "bg-green-100 text-green-700" : ""}
                          >
                            {connection.status === "connected" ? "Active" : "Saved"}
                          </Badge>
                          {connection.status !== "connected" && (
                            <Button size="sm" variant="outline" onClick={() => setCurrentConnection(connection)}>
                              Use Connection
                            </Button>
                          )}
                          {!connection.schemaFileId && (
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
                                  Upload Schema File
                                </>
                              )}
                            </Button>
                          )}
                          {!!connection.schemaFileId && (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-green-600">Schema Uploaded</span>
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(connection)}
                            title="Edit connection"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteConnection(connection.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-host">Host *</Label>
                  <Input {...registerEdit("host", { required: "Host is required" })} placeholder="localhost" />
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
                  {...registerEdit("database", { required: "Database name is required" })}
                  placeholder="company_db"
                />
                {errorsEdit.database && <p className="text-sm text-red-600">{errorsEdit.database.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-username">Username *</Label>
                  <Input {...registerEdit("username", { required: "Username is required" })} placeholder="admin" />
                  {errorsEdit.username && <p className="text-sm text-red-600">{errorsEdit.username.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password">Password</Label>
                  <Input {...registerEdit("password")} type="password" placeholder="••••••••" />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingConnection(null);
                    resetEdit();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
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
