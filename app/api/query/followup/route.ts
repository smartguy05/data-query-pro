import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

/**
 * Builds a context string from query results for the AI.
 * Truncates to avoid token limits while preserving useful information.
 */
function buildResultContext(
  columns: string[],
  rows: any[][],
  totalCount: number
): string {
  if (!columns || !rows || rows.length === 0) {
    return "No results available."
  }

  // Build a markdown table representation
  const header = `| ${columns.join(' | ')} |`
  const separator = `| ${columns.map(() => '---').join(' | ')} |`

  // Limit rows for context - even if user sends more, we cap at 50 for token efficiency
  const displayRows = rows.slice(0, 50)
  const rowsText = displayRows.map(row =>
    `| ${row.map(cell => {
      const cellStr = String(cell ?? 'NULL')
      // Truncate very long cell values
      return cellStr.length > 100 ? cellStr.substring(0, 100) + '...' : cellStr
    }).join(' | ')} |`
  ).join('\n')

  let context = `Columns: ${columns.join(', ')}\n`
  context += `Total Rows: ${totalCount}\n`
  context += `Showing ${displayRows.length} row${displayRows.length !== 1 ? 's' : ''}:\n\n`
  context += `${header}\n${separator}\n${rowsText}`

  if (totalCount > displayRows.length) {
    context += `\n\n... and ${totalCount - displayRows.length} more rows not shown`
  }

  return context
}

export async function POST(request: NextRequest) {
  try {
    const {
      followUpQuestion,
      originalQuestion,
      generatedSql,
      resultColumns,
      resultRows,
      totalRowCount,
      vectorStoreId,
      databaseType,
      schemaData,
      existingFileId
    } = await request.json()

    // Validation
    if (!followUpQuestion) {
      return NextResponse.json({ error: "Follow-up question is required" }, { status: 400 })
    }

    if (!vectorStoreId) {
      return NextResponse.json({ error: "Vector store ID is required" }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    // Build context from results
    const resultContext = buildResultContext(resultColumns, resultRows, totalRowCount)

    const systemPrompt = `
# Role
You are a data analyst assistant helping the user explore their database query results.

# Previous Context
The user asked this original question: "${originalQuestion}"

The following SQL query was generated and executed:
\`\`\`sql
${generatedSql}
\`\`\`

Here are the query results:
${resultContext}

# Your Task
The user has a follow-up question about these results. Analyze their question and decide the BEST way to respond:

## Option 1: Generate a NEW SQL Query
Choose this if the user wants:
- Different or additional data (more columns, different tables)
- Filtered or aggregated data
- Comparisons or trends
- Data that requires a new database query

If you choose this, generate a complete, self-contained SQL query (don't assume previous results exist as a table).

## Option 2: Provide an Explanation
Choose this if the user wants:
- Analysis or interpretation of the current results
- Explanation of patterns, trends, or anomalies
- Summary statistics that can be derived from the visible data
- Help understanding what the data means

# Database Information
Use the uploaded database schema file for ${databaseType} to ensure your SQL queries reference valid tables and columns.

# Response Format (JSON only)
You MUST respond with ONLY a valid JSON object, no other text.

For a query response:
{
  "responseType": "query",
  "sql": "SELECT ...",
  "explanation": "This query will...",
  "confidence": 0.9,
  "warnings": []
}

For an explanation response:
{
  "responseType": "explanation",
  "explanationText": "Based on the results, I can see that...",
  "confidence": 0.9
}

IMPORTANT:
- Respond ONLY with valid JSON
- No markdown, no extra text before or after the JSON
- Do not use variable placeholders in SQL, supply actual values where needed
`

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.1",
      tools: [{
        type: "file_search",
        vector_store_ids: [vectorStoreId]
      }],
      input: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: followUpQuestion
            }
          ]
        }
      ]
    })

    if (response.status !== "completed") {
      console.error("OpenAI API error:", {
        status: response.status,
        error: response.error
      })
      return NextResponse.json({
        error: `OpenAI API request failed: ${response.status} ${response.error?.message || ''}`
      }, { status: 500 })
    }

    const output = response.output_text
    console.log("Follow-up response:", output)

    // Try to parse the response as JSON
    try {
      let jsonContent = output

      // If response contains markdown code block, extract it
      const jsonMatch = output?.match(/```json\s*([\s\S]*?)\s*```/i)
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim()
      }

      const result = JSON.parse(jsonContent)

      // Validate the response structure
      if (result.responseType === 'query') {
        return NextResponse.json({
          responseType: 'query',
          sql: result.sql || '',
          explanation: result.explanation || 'Follow-up query generated',
          confidence: result.confidence ?? 0.8,
          warnings: result.warnings || []
        })
      } else if (result.responseType === 'explanation') {
        return NextResponse.json({
          responseType: 'explanation',
          explanationText: result.explanationText || result.explanation || '',
          confidence: result.confidence ?? 0.8
        })
      } else {
        // Default to explanation if responseType is missing but we have text
        if (result.explanationText || result.explanation) {
          return NextResponse.json({
            responseType: 'explanation',
            explanationText: result.explanationText || result.explanation,
            confidence: result.confidence ?? 0.7
          })
        }
        // Default to query if we have SQL
        if (result.sql) {
          return NextResponse.json({
            responseType: 'query',
            sql: result.sql,
            explanation: result.explanation || 'Generated query',
            confidence: result.confidence ?? 0.7,
            warnings: result.warnings || []
          })
        }
        throw new Error("Could not determine response type")
      }
    } catch (parseError) {
      console.error("Failed to parse follow-up response:", parseError)
      console.error("Raw content:", output)

      // Try to extract useful content from non-JSON response
      // Check if it looks like an explanation
      if (output && !output.includes('SELECT') && !output.includes('select')) {
        return NextResponse.json({
          responseType: 'explanation',
          explanationText: output,
          confidence: 0.5
        })
      }

      // Try to extract SQL
      const sqlMatch = output?.match(/```sql\s*([\s\S]*?)\s*```/i)
      if (sqlMatch) {
        return NextResponse.json({
          responseType: 'query',
          sql: sqlMatch[1].trim(),
          explanation: 'Extracted SQL from response',
          confidence: 0.5,
          warnings: ['Response was not in expected JSON format']
        })
      }

      // If all else fails, return the raw output as explanation
      return NextResponse.json({
        responseType: 'explanation',
        explanationText: output || 'Unable to process your question. Please try rephrasing.',
        confidence: 0.3
      })
    }
  } catch (error: any) {
    console.error("Error in follow-up processing:", error)
    return NextResponse.json({
      error: error.message || "Failed to process follow-up question"
    }, { status: 500 })
  }
}
