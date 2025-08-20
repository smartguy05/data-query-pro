"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Database, Search, FileText, BarChart3, Zap } from "lucide-react"
import Link from "next/link"

const actions = [
  {
    title: "New Query",
    description: "Ask questions in natural language",
    icon: Search,
    href: "/query",
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Generate Report",
    description: "Create executive summary",
    icon: FileText,
    href: "/reports",
    color: "bg-green-100 text-green-600",
  },
  {
    title: "Connect Database",
    description: "Add new data source",
    icon: Database,
    href: "/database",
    color: "bg-purple-100 text-purple-600",
  },
  {
    title: "View Analytics",
    description: "Explore data insights",
    icon: BarChart3,
    href: "/schema",
    color: "bg-orange-100 text-orange-600",
  },
]

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          Quick Actions
        </CardTitle>
        <CardDescription>Common executive tasks and shortcuts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => {
          const IconComponent = action.icon
          return (
            <Link key={index} href={action.href}>
              <Button variant="ghost" className="w-full justify-start p-4 h-auto hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${action.color}`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-slate-900">{action.title}</h4>
                    <p className="text-sm text-slate-600">{action.description}</p>
                  </div>
                </div>
              </Button>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
