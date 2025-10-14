"use client"

import { useState, useEffect } from "react"
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
  CircleX
} from "lucide-react"
import Link from "next/link"

interface MetricSuggestion {
  title: string
  description: string
  query: string
  category: string
  relevantTables?: string[]
}

export default function ContextualDashboard() {
  const [hasConnection, setHasConnection] = useState(false)
  const [hasSchema, setHasSchema] = useState(false)
  const [suggestions, setSuggestions] = useState<MetricSuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [connectionName, setConnectionName] = useState("")
  const [isReGenerating, setIsReGenerating] = useState(false)

  useEffect(() => {
    const checkStatus = () => {
      const connection = localStorage.getItem("currentDbConnection")
      if (connection) {
        const connData = JSON.parse(connection)
        setHasConnection(true)
        setConnectionName(connData.name || "Database")

        // Check if schema is cached
        const schemaKey = `schema_${connData.id}`
        const cachedSchema = localStorage.getItem(schemaKey)
        if (cachedSchema) {
          setHasSchema(true)
          const suggestionsKey = `suggestions_${connData.id}`;
          const cachedSuggestions = localStorage.getItem(suggestionsKey);
          if (!!cachedSuggestions) {
            setSuggestions(JSON.parse(cachedSuggestions));
          } else {
            generateSuggestions(connData.id);            
          }
        }
      }
    }

    checkStatus()
  }, []);
  
  const regenerateSuggestions = async () => {
    setIsReGenerating(true);
    try {
      const connectionSetting = localStorage.getItem("currentDbConnection");
      let connection;
      if (!!connectionSetting) {
        connection = JSON.parse(connectionSetting);
      }
      let cachedSuggestions = localStorage.getItem(`suggestions_${connection.id}`);
      let storedSuggestions = [];
      if (!!cachedSuggestions) {
        storedSuggestions = JSON.parse(cachedSuggestions);
      }
      await generateSuggestions(connection.id, storedSuggestions);
    } finally {
      setIsReGenerating(false);
    }
  }

  const generateSuggestions = async (connectionId: string, currentSuggestions?: any[]) => {
    setLoadingSuggestions(true);
    try {      
      const currentDbConnection = localStorage.getItem("currentDbConnection");
      let dbConnection;
      if (!!currentDbConnection) {
        dbConnection = JSON.parse(currentDbConnection);
      }

      const response = await fetch("/api/dashboard/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, vectorStoreId: dbConnection.vectorStoreId }),
      });

      if (response.ok) {
        const data = await response.json()
        const allSuggestions = [...currentSuggestions ?? [], ...data.suggestions];
        localStorage.setItem(`suggestions_${connectionId}`, JSON.stringify(allSuggestions))
        setSuggestions(allSuggestions || [])
      }
    } catch (error) {
      console.error("Failed to generate suggestions:", error)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const removeSuggestion = (index: number) => {
    try {
      // todo: add confirmation
      const connectionSetting = localStorage.getItem("currentDbConnection");
      let connection;
      if (!!connectionSetting) {
        connection = JSON.parse(connectionSetting);
      }
      let cachedSuggestions = localStorage.getItem(`suggestions_${connection.id}`);
      let storedSuggestions = [];
      if (!!cachedSuggestions) {
        storedSuggestions = JSON.parse(cachedSuggestions);
        if (!!storedSuggestions.length) {
          storedSuggestions.splice(index, 1);
          setSuggestions(storedSuggestions);
          localStorage.setItem(`suggestions_${connection.id}`, JSON.stringify(storedSuggestions))
        }
      }
    } catch (error) {
      console.error("Failed to remove suggestion:", error);
    }
  }
  
  if (!hasConnection) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-card border-b border-border">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to Database Query & Reporting</h1>
              <p className="text-lg text-muted-foreground">Get started by connecting your database and exploring your data</p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Circle className="h-5 w-5 text-slate-400" />
                  Step 1: Connect Your Database
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Connect to your PostgreSQL, MySQL, SQL Server, or SQLite database to start analyzing your data.
                </p>
                <Link href="/database">
                  <Button className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Connect Database
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Circle className="h-5 w-5 text-slate-400" />
                  Step 2: Generate AI Descriptions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  After connecting, visit the Schema page to generate AI descriptions for your tables and columns. This
                  helps the system understand your data better.
                </p>
                <Button variant="outline" disabled className="flex items-center gap-2 bg-transparent">
                  <FileText className="h-4 w-4" />
                  View Schema (Connect database first)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Circle className="h-5 w-5 text-slate-400" />
                  Step 3: Start Querying
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Use natural language to query your data. The AI will convert your questions into SQL and execute them.
                </p>
                <Button variant="outline" disabled className="flex items-center gap-2 bg-transparent">
                  <MessageSquare className="h-4 w-4" />
                  Start Querying (Connect database first)
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard - {connectionName}</h1>
              <p className="text-muted-foreground">AI-powered insights and suggested metrics for your data</p>
            </div>
            <Badge variant="outline" className="text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {!hasSchema ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                Generate AI Descriptions for Better Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                To get personalized metric suggestions, generate AI descriptions for your database schema. This helps
                the system understand your data structure and suggest relevant business metrics.
              </p>
              <Link href="/schema">
                <Button className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  View Schema & Generate Descriptions
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-blue-500" />
                  Suggested Metrics & Reports
                </CardTitle>
                <div className="refresh-button-container">
                  <button 
                      className="flex items-center gap-2 bg-blue-600 text-white" 
                      disabled={isReGenerating}
                      onClick={regenerateSuggestions}
                  >
                    {isReGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating Suggestions...
                        </>
                    ) : (
                        "Generate More Suggestions"
                    )}
                  </button>
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
                              href={`/query?suggestion=${encodeURIComponent(suggestion.query)}&tables=${encodeURIComponent(JSON.stringify(suggestion.relevantTables || []))}`}
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6 text-center">
                  <Database className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Explore Schema</h3>
                  <p className="text-sm text-muted-foreground mb-4">View tables, columns, and relationships</p>
                  <Link href="/schema">
                    <Button variant="outline" size="sm">
                      View Schema
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <MessageSquare className="h-8 w-8 text-green-600 mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Query Data</h3>
                  <p className="text-sm text-muted-foreground mb-4">Ask questions in natural language</p>
                  <Link href="/query">
                    <Button variant="outline" size="sm">
                      Start Querying
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <FileText className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">Manage Reports</h3>
                  <p className="text-sm text-muted-foreground mb-4">Save and schedule reports</p>
                  <Link href="/reports">
                    <Button variant="outline" size="sm">
                      View Reports
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
