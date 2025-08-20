"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Users, DollarSign, Package, BarChart3, PieChart, Plus } from "lucide-react"

const templates = [
  {
    id: 1,
    name: "Executive Summary",
    description: "High-level KPIs and metrics for C-level executives",
    icon: TrendingUp,
    category: "Executive",
    queries: 3,
    color: "bg-blue-100 text-blue-600",
  },
  {
    id: 2,
    name: "Sales Performance",
    description: "Revenue, conversion rates, and sales team metrics",
    icon: DollarSign,
    category: "Sales",
    queries: 5,
    color: "bg-green-100 text-green-600",
  },
  {
    id: 3,
    name: "Customer Analytics",
    description: "Customer acquisition, retention, and lifetime value",
    icon: Users,
    category: "Marketing",
    queries: 4,
    color: "bg-purple-100 text-purple-600",
  },
  {
    id: 4,
    name: "Inventory Report",
    description: "Stock levels, turnover rates, and reorder points",
    icon: Package,
    category: "Operations",
    queries: 6,
    color: "bg-orange-100 text-orange-600",
  },
  {
    id: 5,
    name: "Financial Dashboard",
    description: "P&L, cash flow, and financial health indicators",
    icon: BarChart3,
    category: "Finance",
    queries: 7,
    color: "bg-indigo-100 text-indigo-600",
  },
  {
    id: 6,
    name: "Market Analysis",
    description: "Market trends, competitive analysis, and opportunities",
    icon: PieChart,
    category: "Strategy",
    queries: 4,
    color: "bg-pink-100 text-pink-600",
  },
]

export function ReportTemplates() {
  const createFromTemplate = (templateId: number) => {
    console.log(`Creating report from template ${templateId}`)
    // Navigate to query builder with template pre-loaded
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">Report Templates</h3>
        <p className="text-slate-600">Start with pre-built templates for common business reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => {
          const IconComponent = template.icon
          return (
            <Card key={template.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${template.color}`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="text-sm">{template.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{template.category}</Badge>
                  <span className="text-sm text-slate-600">{template.queries} queries</span>
                </div>

                <Button className="w-full" onClick={() => createFromTemplate(template.id)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Use Template
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
