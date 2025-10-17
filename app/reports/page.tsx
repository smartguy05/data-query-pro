"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus } from "lucide-react"
import { SavedReports } from "@/components/saved-reports"

export default function ReportsPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Saved Reports</h1>
            <p className="text-muted-foreground">View and run your saved queries</p>
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => router.push("/query")}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Query
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Saved Reports */}
        <SavedReports searchTerm={searchTerm} />
      </div>
    </div>
  )
}
