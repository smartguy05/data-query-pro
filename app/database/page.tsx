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
import { Database, CheckCircle, Loader2, Plus, Trash2, Download, Upload } from "lucide-react"

interface DatabaseConnection {
  id: string
  name: string
  type: string
  host: string
  port: string
  database: string
  username: string
  password: string
  description?: string
  status: "connected" | "disconnected"
  schemaFileId?: string;
  vectorStoreId?: string;
  createdAt: string,
}

interface ConnectionFormData {
  type: string
  name: string
  host: string
  port: string
  database: string
  username: string
  password: string
  description: string
}

export default function DatabasePage() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")
  const [savedConnections, setSavedConnections] = useState<DatabaseConnection[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle")

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

  const selectedType = watch("type")

  useEffect(() => {
    const saved = localStorage.getItem("databaseConnections")
    if (saved) {
      try {
        setSavedConnections(JSON.parse(saved))
      } catch (error) {
        console.error("Failed to parse saved connections:", error)
      }
    }
  }, [])

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

  const handleConnect = async (data: ConnectionFormData) => {
    if (!data.type || !data.name || !data.host || !data.database || !data.username) {
      setConnectionStatus("error")
      return
    }

    setIsConnecting(true)
    setConnectionStatus("idle")

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
      }

      // Save to localStorage
      const updatedConnections = [...savedConnections, newConnection]
      setSavedConnections(updatedConnections)
      localStorage.setItem("databaseConnections", JSON.stringify(updatedConnections))

      // Also save current connection for schema introspection
      localStorage.setItem("currentDbConnection", JSON.stringify(newConnection))

      setConnectionStatus("success")
      reset() // Clear form after successful connection
    } catch (error) {
      console.error("Connection failed:", error)
      setConnectionStatus("error")
    } finally {
      setIsConnecting(false)
    }
  }

  const deleteConnection = (id: string) => {
    const updatedConnections = savedConnections.filter((conn) => conn.id !== id)
    setSavedConnections(updatedConnections)
    localStorage.setItem("databaseConnections", JSON.stringify(updatedConnections))
  }

  const setCurrentConnection = (connection: DatabaseConnection) => {
    localStorage.setItem("currentDbConnection", JSON.stringify(connection))
    // Update connection status to connected
    const updatedConnections = savedConnections.map((conn) =>
      conn.id === connection.id
        ? { ...conn, status: "connected" as const }
        : { ...conn, status: "disconnected" as const },
    )
    setSavedConnections(updatedConnections)
    localStorage.setItem("databaseConnections", JSON.stringify(updatedConnections))
  }

  const updateConnection = (connection: DatabaseConnection) => {
    const updatedConnections = savedConnections.map((conn) =>
        conn.id === connection.id
            ? { ...conn, ...connection }
            : conn
    )
    setSavedConnections(updatedConnections)
    localStorage.setItem("databaseConnections", JSON.stringify(updatedConnections))
  }

  const exportData = async () => {
    setIsExporting(true)
    try {
      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        databaseConnections: JSON.parse(localStorage.getItem("databaseConnections") || "[]"),
        currentDbConnection: JSON.parse(localStorage.getItem("currentDbConnection") || "null"),
        schemaData: {},
      }

      // Export all cached schema data
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith("schema_")) {
          const schemaData = localStorage.getItem(key)
          if (schemaData) {
            exportData.schemaData[key] = JSON.parse(schemaData)
          }
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
          localStorage.setItem("databaseConnections", JSON.stringify(importData.databaseConnections))
          setSavedConnections(importData.databaseConnections)
        }

        // Import current connection
        if (importData.currentDbConnection) {
          localStorage.setItem("currentDbConnection", JSON.stringify(importData.currentDbConnection))
        }

        // Import schema data
        if (importData.schemaData && typeof importData.schemaData === "object") {
          Object.entries(importData.schemaData).forEach(([key, value]) => {
            if (key.startsWith("schema_")) {
              localStorage.setItem(key, JSON.stringify(value))
            }
          })
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
    const cacheKey = `schema_${connection.id}`
    const cachedSchema = localStorage.getItem(cacheKey)
    let schemaData = {}
    if (cachedSchema) {
      schemaData = JSON.parse(cachedSchema)
    }
    
    if (!schemaData) {
      throw new Error("No schema data found! Be sure to parse database schema before trying to upload.");
    }

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
        updateConnection(connection);
      } else {
        const errorText = await response.text();
        console.error(`Failed to upload schema file`, errorText);
        throw new Error(`File to upload schema file: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      alert(error);
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Database Connections</h1>
          <p className="text-slate-600">Connect to your data sources for analysis and reporting</p>
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

        <Tabs defaultValue="connect" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connect">New Connection</TabsTrigger>
            <TabsTrigger value="existing">Existing Connections ({savedConnections.length})</TabsTrigger>
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
              {savedConnections.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center space-y-2">
                      <Database className="h-12 w-12 text-slate-400 mx-auto" />
                      <p className="text-slate-600">No saved connections yet</p>
                      <p className="text-sm text-slate-500">Create your first database connection to get started</p>
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
                            <p className="text-sm text-slate-600">
                              {connection.type.toUpperCase()} • {connection.host}:{connection.port}/
                              {connection.database}
                            </p>
                            {connection.description && (
                              <p className="text-xs text-slate-500 mt-1 max-w-md truncate">{connection.description}</p>
                            )}
                            <p className="text-xs text-slate-500">
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
                            <Button size="sm" variant="outline" onClick={() => uploadSchema(connection)}>
                              Upload Schema File
                            </Button>
                          )}
                          {!!connection.schemaFileId && (
                              <span>Schema Uploaded</span>
                          )}
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
      </div>
    </div>
  )
}
