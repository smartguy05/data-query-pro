"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Calendar } from "lucide-react"

export function PerformanceChart() {
  // Mock data for the chart visualization
  const chartData = [
    { month: "Jan", revenue: 2100000, customers: 11200, orders: 3200 },
    { month: "Feb", revenue: 2250000, customers: 11800, orders: 3350 },
    { month: "Mar", revenue: 2180000, customers: 12100, orders: 3180 },
    { month: "Apr", revenue: 2320000, customers: 12400, orders: 3420 },
    { month: "May", revenue: 2450000, customers: 12700, orders: 3580 },
    { month: "Jun", revenue: 2380000, customers: 12850, orders: 3490 },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Performance Overview
            </CardTitle>
            <CardDescription>Revenue, customers, and orders trend analysis</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-700 border-green-200">
              +12.5% vs last period
            </Badge>
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Last 6 months
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Mock Chart Visualization */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
              <span>Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-600 rounded-full"></div>
              <span>Customers</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
              <span>Orders</span>
            </div>
          </div>

          {/* Simplified Chart Representation */}
          <div className="h-64 bg-slate-50 rounded-lg flex items-end justify-around p-4">
            {chartData.map((data, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  {/* Revenue Bar */}
                  <div
                    className="w-8 bg-blue-600 rounded-t"
                    style={{ height: `${(data.revenue / 2500000) * 120}px` }}
                  ></div>
                  {/* Customers Bar */}
                  <div
                    className="w-8 bg-green-600 rounded-t"
                    style={{ height: `${(data.customers / 15000) * 80}px` }}
                  ></div>
                  {/* Orders Bar */}
                  <div
                    className="w-8 bg-orange-600 rounded-t"
                    style={{ height: `${(data.orders / 4000) * 60}px` }}
                  ></div>
                </div>
                <span className="text-xs text-slate-600 font-medium">{data.month}</span>
              </div>
            ))}
          </div>

          {/* Key Insights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">$2.4M</p>
              <p className="text-sm text-slate-600">Current Month Revenue</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">12.8K</p>
              <p className="text-sm text-slate-600">Active Customers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">3.4K</p>
              <p className="text-sm text-slate-600">Monthly Orders</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
