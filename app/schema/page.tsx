import { SchemaExplorer } from "@/components/schema-explorer"

export default function SchemaPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Database Schema</h1>
            <p className="text-muted-foreground">
              Explore your database structure and add AI-generated descriptions to improve query accuracy
            </p>
          </div>

          <SchemaExplorer />
        </div>
      </div>
    </div>
  )
}
