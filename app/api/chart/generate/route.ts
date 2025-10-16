import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import {
  ChartGenerationRequest,
  ChartGenerationResponse,
  ChartConfig,
  CHART_TOOLS,
} from "@/models/chart-config.interface"

export async function POST(request: NextRequest) {
  try {
    const { columns, rows, rowCount, preferredChartType }: ChartGenerationRequest = await request.json()

    if (!columns || !rows || columns.length === 0 || rows.length === 0) {
      return NextResponse.json({ error: "Valid data with columns and rows is required" }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    console.log("[Chart Generation] Analyzing data for visualization...")
    console.log("[Chart Generation] Columns:", columns)
    console.log("[Chart Generation] Row count:", rowCount)
    console.log("[Chart Generation] Preferred chart type:", preferredChartType || "auto")

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Analyze data types for each column
    const columnAnalysis = columns.map((col, colIndex) => {
      const sampleValues = rows.slice(0, 10).map((row) => row[colIndex])
      const nonNullValues = sampleValues.filter((v) => v !== null && v !== undefined && v !== "")

      let dataType = "text"
      if (nonNullValues.every((val) => !isNaN(Number(val)))) {
        dataType = "numeric"
      } else if (nonNullValues.some((val) => !isNaN(Date.parse(val)))) {
        dataType = "date"
      }

      return {
        name: col,
        type: dataType,
        sampleValues: nonNullValues.slice(0, 3),
      }
    })

    const numericColumns = columnAnalysis.filter((c) => c.type === "numeric")
    const dateColumns = columnAnalysis.filter((c) => c.type === "date")
    const textColumns = columnAnalysis.filter((c) => c.type === "text")

    // Build the system prompt
    const systemPrompt = `You are a data visualization expert. Analyze the provided dataset and select the best chart type and configuration.

Dataset Information:
- Total columns: ${columns.length}
- Total rows: ${rowCount}
- Numeric columns: ${numericColumns.map((c) => c.name).join(", ") || "none"}
- Date/time columns: ${dateColumns.map((c) => c.name).join(", ") || "none"}
- Text/categorical columns: ${textColumns.map((c) => c.name).join(", ") || "none"}

Column Details:
${columnAnalysis.map((c) => `- ${c.name} (${c.type}): ${c.sampleValues.join(", ")}`).join("\n")}

${preferredChartType ? `User prefers: ${preferredChartType} chart` : ""}

Chart Selection Guidelines:
1. Bar Chart: Best for comparing discrete categories, counts, or totals across groups
2. Line Chart: Best for trends over time or continuous sequential data
3. Pie Chart: Best for showing proportions/percentages (works best with 3-8 categories)
4. Area Chart: Best for cumulative values or volume over time
5. Scatter Plot: Best for correlation between two numeric variables

Requirements:
- Choose the most appropriate chart type based on data structure
- Select meaningful columns for axes
- Provide clear, descriptive labels
- Use the actual column names from the dataset
- Ensure the configuration matches the available data

Call the appropriate chart creation function with the proper configuration.`

    const userMessage = preferredChartType
      ? `Create a ${preferredChartType} chart from this data. Choose the most appropriate columns and provide meaningful labels.`
      : `Analyze this dataset and create the most appropriate visualization. Consider the data types and relationships between columns.`

    console.log("[Chart Generation] Calling OpenAI Chat Completions API...")

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      tools: CHART_TOOLS as any,
      tool_choice: "auto",
    })

    console.log("[Chart Generation] Response received")

    const message = response.choices[0]?.message

    if (!message) {
      console.error("[Chart Generation] No message in response")
      return NextResponse.json({ error: "No response from AI" }, { status: 500 })
    }

    // Check if AI used a tool call
    const toolCalls = message.tool_calls

    if (!toolCalls || toolCalls.length === 0) {
      console.error("[Chart Generation] No tool calls in response")
      return NextResponse.json({ error: "AI did not generate a chart configuration" }, { status: 500 })
    }

    const toolCall = toolCalls[0] as {
      type: "function"
      function: {
        name: string
        arguments: string
      }
    }

    // Type assertion for OpenAI tool call structure
    if (toolCall.type !== "function" || !toolCall.function) {
      console.error("[Chart Generation] Invalid tool call type")
      return NextResponse.json({ error: "Invalid tool call from AI" }, { status: 500 })
    }

    console.log("[Chart Generation] Tool called:", toolCall.function.name)
    console.log("[Chart Generation] Arguments:", toolCall.function.arguments)

    // Parse the function arguments to get chart config
    const args = JSON.parse(toolCall.function.arguments)

    // Map function name to chart type
    const chartTypeMap: Record<string, ChartConfig["type"]> = {
      create_bar_chart: "bar",
      create_line_chart: "line",
      create_pie_chart: "pie",
      create_area_chart: "area",
      create_scatter_plot: "scatter",
    }

    const chartType = chartTypeMap[toolCall.function.name]

    if (!chartType) {
      return NextResponse.json({ error: `Unknown chart type: ${toolCall.function.name}` }, { status: 500 })
    }

    // Build the chart config with the correct type
    const chartConfig: ChartConfig = {
      type: chartType,
      ...args,
    }

    // Generate reasoning based on the data and chart choice
    const reasoning = generateReasoning(chartType, columnAnalysis, args)

    const result: ChartGenerationResponse = {
      config: chartConfig,
      reasoning,
    }

    console.log("[Chart Generation] Chart configuration generated successfully")
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[Chart Generation] Error:", error)
    return NextResponse.json({ error: error.message || "Failed to generate chart configuration" }, { status: 500 })
  }
}

function generateReasoning(
  chartType: string,
  columnAnalysis: any[],
  args: any,
): string {
  const numericCount = columnAnalysis.filter((c) => c.type === "numeric").length
  const dateCount = columnAnalysis.filter((c) => c.type === "date").length

  switch (chartType) {
    case "bar":
      return `Selected bar chart to compare ${args.xAxisColumn} across ${args.yAxisColumns.join(", ")}. This visualization makes it easy to see differences between categories.`
    case "line":
      return `Selected line chart to show trends in ${args.yAxisColumns.join(", ")} over ${args.xAxisColumn}. ${dateCount > 0 ? "This works well for time-series data." : "This helps visualize continuous changes."}`
    case "pie":
      return `Selected pie chart to show the proportional breakdown of ${args.valueColumn} by ${args.nameColumn}. This clearly displays each category's share of the whole.`
    case "area":
      return `Selected area chart to visualize the volume/magnitude of ${args.yAxisColumns.join(", ")} over ${args.xAxisColumn}. This emphasizes the cumulative nature of the data.`
    case "scatter":
      return `Selected scatter plot to explore the relationship between ${args.xAxisColumn} and ${args.yAxisColumn}. ${numericCount >= 2 ? "This is ideal for correlation analysis between numeric variables." : "This helps identify patterns and outliers."}`
    default:
      return `Generated a ${chartType} chart based on the data structure.`
  }
}
