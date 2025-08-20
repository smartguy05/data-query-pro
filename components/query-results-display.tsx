"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronUp, ChevronDown, Download, Search, BarChart3, TableIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface QueryResultsProps {
  data: {
    columns: string[]
    rows: any[][]
    rowCount: number
    executionTime: number
  }
}

type SortDirection = "asc" | "desc" | null
type ViewMode = "table" | "chart"

export function QueryResultsDisplay({ data }: QueryResultsProps) {
  const [sortColumn, setSortColumn] = useState<number | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [selectedColumns, setSelectedColumns] = useState<number[]>([])

  // Data type detection
  const columnTypes = useMemo(() => {
    return data.columns.map((_, colIndex) => {
      const sampleValues = data.rows.slice(0, 10).map((row) => row[colIndex])

      if (sampleValues.every((val) => val === null || val === undefined || val === "")) {
        return "empty"
      }

      if (sampleValues.every((val) => !isNaN(Number(val)) && val !== "")) {
        return "number"
      }

      if (sampleValues.every((val) => !isNaN(Date.parse(val)))) {
        return "date"
      }

      return "text"
    })
  }, [data])

  // Filtered and sorted data
  const processedData = useMemo(() => {
    let filtered = data.rows

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((row) =>
        row.some((cell) => cell?.toString().toLowerCase().includes(searchTerm.toLowerCase())),
      )
    }

    // Apply sorting
    if (sortColumn !== null && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn]
        const bVal = b[sortColumn]

        if (columnTypes[sortColumn] === "number") {
          const aNum = Number(aVal) || 0
          const bNum = Number(bVal) || 0
          return sortDirection === "asc" ? aNum - bNum : bNum - aNum
        }

        if (columnTypes[sortColumn] === "date") {
          const aDate = new Date(aVal).getTime() || 0
          const bDate = new Date(bVal).getTime() || 0
          return sortDirection === "asc" ? aDate - bDate : bDate - aDate
        }

        const aStr = aVal?.toString() || ""
        const bStr = bVal?.toString() || ""
        return sortDirection === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
      })
    }

    return filtered
  }, [data.rows, searchTerm, sortColumn, sortDirection, columnTypes])

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize)
  const paginatedData = processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSort = (columnIndex: number) => {
    if (sortColumn === columnIndex) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"))
      if (sortDirection === "desc") {
        setSortColumn(null)
      }
    } else {
      setSortColumn(columnIndex)
      setSortDirection("asc")
    }
  }

  const formatCellValue = (value: any, columnIndex: number) => {
    if (value === null || value === undefined) return "-"

    const type = columnTypes[columnIndex]

    if (type === "number") {
      const num = Number(value)
      return isNaN(num) ? value : num.toLocaleString()
    }

    if (type === "date") {
      try {
        return new Date(value).toLocaleDateString()
      } catch {
        return value
      }
    }

    return value.toString()
  }

  const exportToCSV = () => {
    const csvContent = [
      data.columns.join(","),
      ...processedData.map((row) => row.map((cell) => `"${cell?.toString().replace(/"/g, '""') || ""}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "query-results.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToJSON = () => {
    const jsonData = processedData.map((row) => {
      const obj: any = {}
      data.columns.forEach((col, i) => {
        obj[col] = row[i]
      })
      return obj
    })

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "query-results.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  // Get numeric columns for chart view
  const numericColumns = data.columns
    .map((col, index) => ({ col, index }))
    .filter(({ index }) => columnTypes[index] === "number")

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TableIcon className="h-5 w-5 text-blue-600" />
              Query Results
            </CardTitle>
            <CardDescription>
              {processedData.length} of {data.rowCount} rows
              {searchTerm && ` (filtered from ${data.rows.length})`}• Executed in {data.executionTime}ms
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table">
                  <div className="flex items-center gap-2">
                    <TableIcon className="h-4 w-4" />
                    Table
                  </div>
                </SelectItem>
                <SelectItem value="chart" disabled={numericColumns.length === 0}>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Chart
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportToJSON}>
              <Download className="h-4 w-4 mr-2" />
              JSON
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search results..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 rows</SelectItem>
              <SelectItem value="25">25 rows</SelectItem>
              <SelectItem value="50">50 rows</SelectItem>
              <SelectItem value="100">100 rows</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Display */}
        {viewMode === "table" ? (
          <div className="space-y-4">
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    {data.columns.map((col, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => handleSort(i)}
                      >
                        <div className="flex items-center gap-2">
                          <span>{col}</span>
                          <Badge variant="outline" className="text-xs">
                            {columnTypes[i]}
                          </Badge>
                          {sortColumn === i &&
                            (sortDirection === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            ))}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50 transition-colors">
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-3 text-slate-900">
                          {formatCellValue(cell, j)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, processedData.length)}{" "}
                  of {processedData.length} results
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <span className="text-sm text-slate-600">
                    Page {currentPage} of {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Alert>
            <BarChart3 className="h-4 w-4" />
            <AlertDescription>
              Chart visualization would be implemented here for numeric columns:{" "}
              {numericColumns.map(({ col }) => col).join(", ")}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
