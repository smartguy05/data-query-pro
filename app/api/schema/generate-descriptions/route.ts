import { type NextRequest, NextResponse } from "next/server"
import { generateTableDescription, generateColumnDescription } from "@/utils/generate-descriptions"

export async function POST(request: NextRequest) {
  try {
    const { schema, databaseDescription, batchInfo } = await request.json()

    console.log(`Processing AI descriptions for batch ${batchInfo?.current || 1}/${batchInfo?.total || 1}`)
    console.log(`Tables in this batch: ${batchInfo?.tableNames?.join(", ") || "Unknown"}`)

    if (!process.env.OPENAI_API_KEY) {
      const enhancedSchema = {
        ...schema,
        tables: schema.tables.map((table: any) => ({
          ...table,
          aiDescription:
            table.aiDescription || generateTableDescription(table.name, table.columns, databaseDescription),
          columns: table.columns.map((column: any) => ({
            ...column,
            aiDescription:
              column.aiDescription ||
              generateColumnDescription(
                table.name,
                column.name,
                column.type,
                column.primary_key,
                column.foreign_key,
                databaseDescription,
              ),
          })),
        })),
      }
      return NextResponse.json({ success: true, schema: enhancedSchema })
    }

    const enhancedSchema = { ...schema }

    async function callOpenAIWithRetry(prompt: string, maxTokens: number, retries = 3): Promise<string | null> {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          console.log(`OpenAI API call attempt ${attempt}/${retries}`)

          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.2,
              max_tokens: maxTokens,
            }),
            signal: AbortSignal.timeout(30000), // 30 second timeout
          })

          if (response.ok) {
            const data = await response.json()
            return data.choices[0]?.message?.content?.trim() || null
          } else if (response.status === 429) {
            // Rate limited - wait longer before retry
            const waitTime = Math.pow(2, attempt) * 2000 // 4s, 8s, 16s
            console.log(`Rate limited, waiting ${waitTime}ms before retry`)
            await new Promise((resolve) => setTimeout(resolve, waitTime))
            continue
          } else {
            console.error(`OpenAI API error:`, response.status, response.statusText)
            return null
          }
        } catch (error: any) {
          console.error(`OpenAI API call attempt ${attempt} failed:`, error.message)

          if (attempt === retries) {
            return null
          }

          const waitTime = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
          console.log(`Waiting ${waitTime}ms before retry`)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        }
      }
      return null
    }

    for (let i = 0; i < enhancedSchema.tables.length; i++) {
      const table = enhancedSchema.tables[i]
      console.log(`Processing table ${i + 1}/${enhancedSchema.tables.length}: ${table.name}`)

      if (!table.aiDescription) {
        const tablePrompt = `You are a database analyst helping to document a business database. 

${
  databaseDescription
    ? `BUSINESS CONTEXT: ${databaseDescription}

`
    : ""
}DATABASE TABLE ANALYSIS:
Table Name: ${table.name}
Columns: ${table.columns.map((col: any) => `${col.name} (${col.type}${col.primary_key ? ", PRIMARY KEY" : ""}${col.foreign_key ? ", FOREIGN KEY → " + col.foreign_key : ""}${!col.nullable ? ", NOT NULL" : ""})`).join(", ")}

TASK: Write a clear, business-focused description (1-2 sentences) explaining:
1. What business data this table stores
2. Its role in the overall system/business process

Focus on business value and purpose, not technical implementation. Use professional, clear language that business stakeholders would understand.`

        const aiDescription = await callOpenAIWithRetry(tablePrompt, 200)
        table.aiDescription = aiDescription || generateTableDescription(table.name, table.columns, databaseDescription)

        if (i < enhancedSchema.tables.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500)) // 500ms delay
        }
      }

      // Generate column descriptions with improved prompts
      for (let j = 0; j < table.columns.length; j++) {
        const column = table.columns[j]

        if (!column.aiDescription) {
          const columnPrompt = `You are documenting a database column for business users.

${
  databaseDescription
    ? `BUSINESS CONTEXT: ${databaseDescription}

`
    : ""
}TABLE CONTEXT: ${table.name} - ${table.aiDescription || "Business data table"}

COLUMN DETAILS:
- Name: ${column.name}
- Data Type: ${column.type}
${column.primary_key ? "- Role: PRIMARY KEY (unique identifier)" : ""}
${column.foreign_key ? `- Role: FOREIGN KEY → ${column.foreign_key}` : ""}
${!column.nullable ? "- Required field (NOT NULL)" : "- Optional field"}

TASK: Write a concise, business-focused description (1 sentence) explaining what this column stores and its business purpose. Focus on the business meaning, not technical details.`

          const aiDescription = await callOpenAIWithRetry(columnPrompt, 100)
          column.aiDescription =
            aiDescription ||
            generateColumnDescription(
              table.name,
              column.name,
              column.type,
              column.primary_key,
              column.foreign_key,
              databaseDescription,
            )
        }
      }
    }

    return NextResponse.json({ success: true, schema: enhancedSchema })
  } catch (error) {
    console.error("Error processing AI descriptions:", error)
    return NextResponse.json({ success: false, error: "Failed to generate descriptions" }, { status: 500 })
  }
}
