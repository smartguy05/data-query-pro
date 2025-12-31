"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Database,
  FileText,
  MessageSquare,
  Lightbulb,
  ArrowRight,
  CheckCircle,
  Circle,
  Loader2,
  CircleX,
  Clock,
  TrendingUp,
  Upload,
  Star,
  AlertCircle,
  Info,
  AlertTriangle,
  X
} from "lucide-react"
import Link from "next/link"
import { SavedReport } from "@/models/saved-report.interface"
import { useDatabaseOptions } from "@/lib/database-connection-options"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { getStorageService, MetricSuggestion } from "@/lib/services/storage"

interface Notification {
  id: string
  type: "warning" | "info" | "error"
  title: string
  message: string
  actionText?: string
  actionLink?: string
}

export default function ContextualDashboard() {
  const connectionOptions = useDatabaseOptions()
  const { toast } = useToast()
  const [hasConnection, setHasConnection] = useState(false)
  const [hasSchemaFile, setHasSchemaFile] = useState(false)
  const [hasSchema, setHasSchema] = useState(false)
  const [hasDescriptions, setHasDescriptions] = useState(false)
  const [suggestions, setSuggestions] = useState<MetricSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [connectionName, setConnectionName] = useState("")
  const [isReGenerating, setIsReGenerating] = useState(false)
  const [recentReports, setRecentReports] = useState<SavedReport[]>([])
  const [favoriteReports, setFavoriteReports] = useState<SavedReport[]>([])
  const [reportCount, setReportCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([])
  const isLoadingSuggestionsRef = useRef(false)

  const loadRecentReports = useCallback(async (connectionId: string) => {
    const storage = getStorageService()
    const connectionReports = await storage.reports.getReports(undefined, connectionId)

    setReportCount(connectionReports.length)

    // Get favorite reports
    const favorites = connectionReports.filter(report => report.isFavorite)
    setFavoriteReports(favorites)

    // Sort by lastRun (if exists), then by lastModified, then by createdAt
    const sorted = connectionReports.sort((a, b) => {
      const aTime = a.lastRun || a.lastModified || a.createdAt
      const bTime = b.lastRun || b.lastModified || b.createdAt
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })

    // Get top 3 most recent
    setRecentReports(sorted.slice(0, 3))
  }, [])

  const generateSuggestions = useCallback(async (connectionId: string, currentSuggestions?: MetricSuggestion[], retryCount: number = 0) => {
    if (isLoadingSuggestionsRef.current) return
    isLoadingSuggestionsRef.current = true
    setLoadingSuggestions(true)

    const storage = getStorageService()

    try {
      const connection = connectionOptions.getConnection(connectionId)

      if (!connection?.vectorStoreId) {
        console.error("No vector store ID found for connection")
        toast({
          title: "Schema Not Uploaded",
          description: "Please upload your schema to OpenAI first from the Database page.",
          variant: "destructive"
        })
        return
      }

      const response = await fetch("/api/dashboard/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, vectorStoreId: connection.vectorStoreId }),
      })

      if (response.ok) {
        const data = await response.json()
        const allSuggestions = [...(currentSuggestions ?? []), ...data.suggestions]
        await storage.suggestions.setSuggestions(connectionId, allSuggestions)
        setSuggestions(allSuggestions || [])
        toast({
          title: "Success",
          description: `Generated ${data.suggestions?.length || 0} new suggestions`,
        })
      } else {
        const errorData = await response.json()
        console.error("API error:", errorData)

        // Check if vector store not found and retry once
        if (errorData.needsReupload && retryCount === 0) {
          console.log("Vector store not found, attempting to re-upload schema...")
          toast({
            title: "Re-uploading Schema",
            description: "Vector store not found. Re-uploading schema to OpenAI...",
          })

          // Get the schema from context
          const schema = connectionOptions.getSchema(connectionId)
          if (!schema) {
            toast({
              title: "Schema Not Found",
              description: "Cannot re-upload schema. Please introspect your schema first.",
              variant: "destructive"
            })
            return
          }

          // Upload schema to OpenAI
          const uploadResponse = await fetch("/api/schema/upload-schema", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: schema,
              existingFileId: connection.schemaFileId,
              existingVectorStoreId: connection.vectorStoreId
            }),
          })

          if (uploadResponse.ok) {
            const uploadData = await uploadResponse.json()
            console.log("Schema re-uploaded successfully:", uploadData)

            // Update connection with new IDs
            const updatedConnection = {
              ...connection,
              schemaFileId: uploadData.fileId,
              vectorStoreId: uploadData.vectorStoreId
            }
            connectionOptions.updateConnection(updatedConnection)

            toast({
              title: "Schema Re-uploaded",
              description: "Retrying suggestions generation...",
            })

            // Retry suggestions generation with new vector store ID
            await generateSuggestions(connectionId, currentSuggestions, retryCount + 1)
          } else {
            toast({
              title: "Re-upload Failed",
              description: "Failed to re-upload schema. Please try manually from the Database page.",
              variant: "destructive"
            })
          }
        } else {
          toast({
            title: "Error",
            description: errorData.details || errorData.error || "Failed to generate suggestions",
            variant: "destructive"
          })
        }
      }
    } catch (error) {
      console.error("Failed to generate suggestions:", error)
      toast({
        title: "Error",
        description: "Failed to generate suggestions. Please check the console for details.",
        variant: "destructive"
      })
    } finally {
      isLoadingSuggestionsRef.current = false
      setLoadingSuggestions(false)
    }
  }, [connectionOptions, toast])

  const detectNotifications = useCallback(async () => {
    const detectedNotifications: Notification[] = []
    const connection = connectionOptions.getConnection()

    if (!connection) return

    const storage = getStorageService()

    // Check for schema not uploaded after introspection
    const schema = connectionOptions.getSchema()
    if (schema && schema.tables && schema.tables.length > 0) {
      if (!connection.schemaFileId || !connection.vectorStoreId) {
        detectedNotifications.push({
          id: "schema-not-uploaded",
          type: "warning",
          title: "Schema Not Uploaded",
          message: "You've introspected your schema but haven't uploaded it to AI yet. This is required for natural language queries.",
          actionText: "Upload Now",
          actionLink: "/database"
        })
      }

      // Check for missing AI descriptions
      const hasDescriptions = schema.tables.some(table =>
        table.description || table.aiDescription ||
        table.columns.some(col => col.description || col.aiDescription)
      )
      if (!hasDescriptions) {
        detectedNotifications.push({
          id: "missing-descriptions",
          type: "info",
          title: "AI Descriptions Not Generated",
          message: "Generate AI descriptions for your schema to improve query accuracy and get personalized metric suggestions.",
          actionText: "Generate Descriptions",
          actionLink: "/schema"
        })
      }
    }

    // Check for reports that haven't been run in a while (favorites only)
    const allReports = await storage.reports.getReports(undefined, connection.id)
    const staleReports = allReports.filter(report => {
      if (!report.isFavorite) return false
      if (!report.lastRun) return false
      const daysSinceRun = Math.floor(
        (Date.now() - new Date(report.lastRun).getTime()) / (1000 * 60 * 60 * 24)
      )
      return daysSinceRun > 60
    })
    if (staleReports.length > 0) {
      detectedNotifications.push({
        id: "stale-favorite-reports",
        type: "info",
        title: "Favorite Reports Haven't Been Run",
        message: `You have ${staleReports.length} favorite report${staleReports.length > 1 ? "s" : ""} that haven't been run in over 60 days.`,
        actionText: "View Reports",
        actionLink: "/reports"
      })
    }

    setNotifications(detectedNotifications)
  }, [connectionOptions])

  useEffect(() => {
    // Wait for context to initialize before checking status
    if (!connectionOptions.isInitialized) {
      return
    }

    const checkStatus = async () => {
      const connection = connectionOptions.getConnection()
      if (connection) {
        setHasConnection(true)
        setConnectionName(connection.name || connection.database || "Database")

        // Reset flags before checking
        setHasSchemaFile(false)
        setHasSchema(false)
        setHasDescriptions(false)
        setSuggestions([])

        // Check if schema file has been uploaded to OpenAI
        if (connection.schemaFileId && connection.vectorStoreId) {
          setHasSchemaFile(true)
        }

        // Check if schema is cached locally
        const schema = connectionOptions.getSchema()
        if (schema && schema.tables && schema.tables.length > 0) {
          setHasSchema(true)

          // Check if AI descriptions exist
          const hasAnyDescriptions = schema.tables.some(table =>
            table.description || table.aiDescription ||
            table.columns.some(col => col.description || col.aiDescription)
          )
          setHasDescriptions(hasAnyDescriptions)

          // Load suggestions if descriptions exist
          if (hasAnyDescriptions) {
            const storage = getStorageService()
            const cachedSuggestions = await storage.suggestions.getSuggestions(connection.id)
            if (cachedSuggestions && cachedSuggestions.length > 0) {
              setSuggestions(cachedSuggestions)
            } else if (!isLoadingSuggestionsRef.current) {
              generateSuggestions(connection.id)
            }
          }
        }

        // Load recent reports for this connection
        loadRecentReports(connection.id)
      } else {
        setHasConnection(false)
      }
    }

    checkStatus()
    detectNotifications()
  }, [connectionOptions.isInitialized, connectionOptions.currentConnection?.id, generateSuggestions, loadRecentReports, detectNotifications])

  useEffect(() => {
    // Load dismissed notifications from storage
    const loadDismissedNotifications = async () => {
      const storage = getStorageService()
      const dismissed = await storage.notifications.getDismissedNotifications()
      setDismissedNotifications(dismissed)
    }
    loadDismissedNotifications()
  }, [])

  const regenerateSuggestions = async () => {
    setIsReGenerating(true)
    try {
      const connection = connectionOptions.getConnection()

      if (!connection) {
        toast({
          title: "No Connection",
          description: "No database connection found. Please select a connection first.",
          variant: "destructive"
        })
        return
      }

      if (!connection.vectorStoreId) {
        toast({
          title: "Schema Not Uploaded",
          description: "Please upload your schema to OpenAI first from the Database page.",
          variant: "destructive"
        })
        return
      }

      const storage = getStorageService()
      const storedSuggestions = await storage.suggestions.getSuggestions(connection.id)
      await generateSuggestions(connection.id, storedSuggestions)
    } catch (error) {
      console.error("Error regenerating suggestions:", error)
      toast({
        title: "Error",
        description: "Failed to generate suggestions. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsReGenerating(false)
    }
  }

  const removeSuggestion = async (index: number) => {
    try {
      const connection = connectionOptions.getConnection()
      if (!connection) return

      const storage = getStorageService()
      await storage.suggestions.removeSuggestion(connection.id, index)

      // Update local state
      const updatedSuggestions = [...suggestions]
      updatedSuggestions.splice(index, 1)
      setSuggestions(updatedSuggestions)
    } catch (error) {
      console.error("Failed to remove suggestion:", error)
    }
  }

  const dismissNotification = async (notificationId: string) => {
    const storage = getStorageService()
    await storage.notifications.dismissNotification(notificationId)
    setDismissedNotifications(prev => [...prev, notificationId])
  }

  // Render connection selector
  const renderConnectionSelector = () => {
    if (connectionOptions.connections.length <= 1) return null

    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label htmlFor="dashboard-connection-select" className="text-sm font-medium whitespace-nowrap">
              Active Connection:
            </Label>
            <Select
              value={connectionOptions.currentConnection?.id || ""}
              onValueChange={(connectionId) => {
                const connection = connectionOptions.connections.find(c => c.id === connectionId)
                if (connection) {
                  connectionOptions.setCurrentConnection(connection)
                  toast({
                    title: "Connection Changed",
                    description: `Switched to ${connection.name || connection.database}`,
                  })
                }
              }}
            >
              <SelectTrigger id="dashboard-connection-select" className="w-full max-w-md">
                <SelectValue placeholder="Select a database connection" />
              </SelectTrigger>
              <SelectContent>
                {connectionOptions.connections.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.name || conn.database} ({conn.host})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Render progress indicator
  const renderProgressIndicator = () => {
    const steps = [
      { label: "Database Connected", completed: hasConnection },
      { label: "Schema Introspected", completed: hasSchema },
      { label: "Schema Uploaded", completed: hasSchemaFile },
      { label: "AI Descriptions Generated", completed: hasDescriptions },
    ]

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Setup Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center gap-2">
                {step.completed ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-400" />
                )}
                <span className={`text-xs ${step.completed ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
                {index < steps.length - 1 && <ArrowRight className="h-3 w-3 text-slate-400" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // State 1: No database connection
  if (!hasConnection) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-card border-b border-border">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to DataQuery Pro</h1>
              <p className="text-lg text-muted-foreground">AI-powered database analysis and natural language queries</p>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-6">
          {renderProgressIndicator()}

          <Card className="border-2 border-blue-200 dark:border-blue-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-6 w-6 text-blue-600" />
                Get Started: Connect Your Database
              </CardTitle>
              <CardDescription>
                Connect to PostgreSQL to start analyzing your data with AI-powered insights
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">What you'll be able to do:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>Query your database using natural language</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>Get AI-generated insights and metric suggestions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>Create and save parameterized reports</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span>Explore your schema with AI-generated descriptions</span>
                  </li>
                </ul>
              </div>
              <Link href="/database">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                  <Database className="h-5 w-5 mr-2" />
                  Connect Your First Database
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <Toaster />
      </div>
    )
  }

  // State 2: Has connection but no schema
  if (!hasSchema) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-card border-b border-border">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Dashboard - {connectionName}</h1>
                <p className="text-muted-foreground">Complete setup to unlock AI-powered features</p>
              </div>
              <Badge variant="outline" className="text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-6">
          {renderConnectionSelector()}
          {renderProgressIndicator()}

          <Card className="border-2 border-amber-200 dark:border-amber-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-amber-600" />
                Next Step: Introspect Your Schema
              </CardTitle>
              <CardDescription>
                Load your database schema to enable AI-powered queries and insights
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Schema introspection analyzes your database structure (tables, columns, relationships) so the AI can
                generate accurate queries and provide relevant suggestions.
              </p>
              <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">How to introspect your schema:</h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Go to the Schema page</li>
                  <li>Schema introspection will start automatically</li>
                  <li>Wait for the analysis to complete</li>
                  <li>Return here to continue setup</li>
                </ol>
              </div>
              <Link href="/schema">
                <Button size="lg" className="bg-amber-600 hover:bg-amber-700">
                  <FileText className="h-5 w-5 mr-2" />
                  Go to Schema Page
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <Toaster />
      </div>
    )
  }

  // State 3: Has schema but not uploaded to OpenAI
  if (!hasSchemaFile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-card border-b border-border">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Dashboard - {connectionName}</h1>
                <p className="text-muted-foreground">Complete setup to unlock AI-powered features</p>
              </div>
              <Badge variant="outline" className="text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-6">
          {renderConnectionSelector()}
          {renderProgressIndicator()}

          <Card className="border-2 border-purple-200 dark:border-purple-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-6 w-6 text-purple-600" />
                Next Step: Upload Schema to AI
              </CardTitle>
              <CardDescription>
                Upload your schema to OpenAI to enable natural language query generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your schema has been introspected! Now upload it to OpenAI so the AI can use it to generate accurate SQL
                queries from your natural language questions.
              </p>
              <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">How to upload your schema:</h4>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>Go to the Database page</li>
                  <li>Find your connection</li>
                  <li>Click "Upload Schema File" button</li>
                  <li>Wait for the upload to complete</li>
                </ol>
              </div>
              <Link href="/database">
                <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
                  <Upload className="h-5 w-5 mr-2" />
                  Go to Database Settings
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <Toaster />
      </div>
    )
  }

  // State 4: Has schema but no AI descriptions
  if (!hasDescriptions) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-card border-b border-border">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Dashboard - {connectionName}</h1>
                <p className="text-muted-foreground">Almost ready for AI-powered insights!</p>
              </div>
              <Badge variant="outline" className="text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto p-6">
          {renderConnectionSelector()}
          {renderProgressIndicator()}

          <Card className="border-2 border-green-200 dark:border-green-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-6 w-6 text-green-600" />
                Final Step: Generate AI Descriptions
              </CardTitle>
              <CardDescription>
                Add AI-generated descriptions to improve query accuracy and get personalized metric suggestions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                AI descriptions help the system understand your data semantics, resulting in more accurate queries and
                better metric suggestions tailored to your business.
              </p>
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">What AI descriptions provide:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Business context for tables and columns</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>More accurate natural language query generation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>Personalized metric and report suggestions</span>
                  </li>
                </ul>
              </div>
              <Link href="/schema">
                <Button size="lg" className="bg-green-600 hover:bg-green-700">
                  <FileText className="h-5 w-5 mr-2" />
                  Go to Schema & Generate Descriptions
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Show basic quick actions even without descriptions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <Card>
              <CardContent className="p-6 text-center">
                <MessageSquare className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Query Your Data</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You can start querying now, but AI descriptions will improve accuracy
                </p>
                <Link href="/query">
                  <Button variant="outline" size="sm">
                    Start Querying
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Database className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Explore Schema</h3>
                <p className="text-sm text-muted-foreground mb-4">View your database structure and relationships</p>
                <Link href="/schema">
                  <Button variant="outline" size="sm">
                    View Schema
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
        <Toaster />
      </div>
    )
  }

  // State 5: Fully set up - show dashboard with reports and suggestions
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard - {connectionName}</h1>
              <p className="text-muted-foreground">AI-powered insights and analytics for your data</p>
            </div>
            <Badge variant="outline" className="text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Ready to Use
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Connection Selector */}
        {renderConnectionSelector()}

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="space-y-3">
            {notifications
              .filter(notification => !dismissedNotifications.includes(notification.id))
              .map((notification) => (
                <div
                  key={notification.id}
                  className={`border-l-4 rounded-lg p-4 ${
                    notification.type === "error"
                      ? "bg-red-50 dark:bg-red-950 border-red-500"
                      : notification.type === "warning"
                      ? "bg-amber-50 dark:bg-amber-950 border-amber-500"
                      : "bg-blue-50 dark:bg-blue-950 border-blue-500"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {notification.type === "error" ? (
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      ) : notification.type === "warning" ? (
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      ) : (
                        <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">{notification.title}</h4>
                        <p className="text-sm text-muted-foreground mb-3">{notification.message}</p>
                        {notification.actionLink && notification.actionText && (
                          <Link href={notification.actionLink}>
                            <Button
                              size="sm"
                              variant={notification.type === "error" ? "destructive" : "default"}
                              className={
                                notification.type === "warning"
                                  ? "bg-amber-600 hover:bg-amber-700"
                                  : notification.type === "info"
                                  ? "bg-blue-600 hover:bg-blue-700"
                                  : ""
                              }
                            >
                              {notification.actionText}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissNotification(notification.id)}
                      className="hover:bg-transparent"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Saved Reports</p>
                  <p className="text-2xl font-bold">{reportCount}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">AI Suggestions</p>
                  <p className="text-2xl font-bold">{suggestions.length}</p>
                </div>
                <Lightbulb className="h-8 w-8 text-amber-600 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Database</p>
                  <p className="text-lg font-semibold truncate">{connectionName}</p>
                </div>
                <Database className="h-8 w-8 text-green-600 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Favorite Reports */}
        {favoriteReports.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                  Favorite Reports
                </CardTitle>
                <Link href="/reports">
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
              <CardDescription>Quick access to your starred reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {favoriteReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => {
                      const params = new URLSearchParams({
                        suggestion: encodeURIComponent(report.naturalLanguageQuery),
                        sql: encodeURIComponent(report.sql)
                      })
                      window.location.href = `/query?${params.toString()}`
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-sm line-clamp-1">{report.name}</h4>
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {report.description || report.naturalLanguageQuery}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {report.parameters && report.parameters.length > 0
                          ? `${report.parameters.length} param${report.parameters.length > 1 ? "s" : ""}`
                          : "No params"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {report.lastRun
                          ? new Date(report.lastRun).toLocaleDateString()
                          : "Not run"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Reports */}
        {recentReports.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Recent Reports
                </CardTitle>
                <Link href="/reports">
                  <Button variant="outline" size="sm">
                    View All Reports
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentReports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{report.name}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {report.description || report.naturalLanguageQuery}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {report.lastRun
                            ? `Run ${new Date(report.lastRun).toLocaleDateString()}`
                            : `Created ${new Date(report.createdAt).toLocaleDateString()}`}
                        </span>
                        {report.parameters && report.parameters.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {report.parameters.length} parameter{report.parameters.length > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Link href={`/reports`}>
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 text-center">
              <MessageSquare className="h-10 w-10 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Create New Query</h3>
              <p className="text-sm text-muted-foreground mb-4">Ask questions in natural language</p>
              <Link href="/query">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Start Querying
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 text-center">
              <FileText className="h-10 w-10 text-purple-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Manage Reports</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {reportCount > 0 ? `View and run ${reportCount} saved reports` : "No saved reports yet"}
              </p>
              <Link href="/reports">
                <Button variant="outline" className="w-full">
                  {reportCount > 0 ? "View Reports" : "Go to Reports"}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 text-center">
              <Database className="h-10 w-10 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Explore Schema</h3>
              <p className="text-sm text-muted-foreground mb-4">View tables, columns, and relationships</p>
              <Link href="/schema">
                <Button variant="outline" className="w-full">
                  View Schema
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* AI Suggestions */}
        <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-blue-500" />
                    Suggested Metrics & Reports
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isReGenerating}
                    onClick={regenerateSuggestions}
                  >
                    {isReGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      "Generate More"
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Based on your database schema, here are some metrics and reports you might find valuable:
                </p>

                {loadingSuggestions ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-muted-foreground mt-2">Analyzing your schema to generate suggestions...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {suggestions.map((suggestion, index) => (
                      <Card key={index} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                          <CardTitle>
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-foreground">{suggestion.title}</h4>
                              <button onClick={() => removeSuggestion(index)}>
                                <CircleX></CircleX>
                              </button>
                            </div>
                          </CardTitle>
                          <CardDescription>
                            <Badge variant="secondary" className="text-xs">
                              {suggestion.category}
                            </Badge>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground mb-3">{suggestion.description}</p>
                        </CardContent>
                        <CardFooter>
                          <Link
                              href={`/query?suggestion=${encodeURIComponent(suggestion.query)}&description=${encodeURIComponent(suggestion.description)}&tables=${encodeURIComponent(JSON.stringify(suggestion.relevantTables || []))}`}
                          >
                            <Button size="sm" variant="outline" className="w-full bg-transparent">
                              Generate This Report
                            </Button>
                          </Link>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
      </div>
      <Toaster />
    </div>
  )
}
