import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { generateTableDescription, generateColumnDescription } from "@/utils/generate-descriptions"
import { checkRateLimit, getOpenAIKey } from "@/utils/rate-limiter"
import { getAuthContext } from '@/lib/auth/require-auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    // Check rate limit first
    const rateLimitResult = checkRateLimit(request);
    if (!rateLimitResult.allowed) {
      console.log("Rate limit exceeded for request");
      return NextResponse.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: "Demo rate limit exceeded. Please provide your own OpenAI API key to continue.",
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime,
        },
        { status: 429 }
      );
    }

    const { schema, databaseDescription, batchInfo } = await request.json()

    console.log(`Processing AI descriptions for batch ${batchInfo?.current || 1}/${batchInfo?.total || 1}`)
    console.log(`Tables in this batch: ${batchInfo?.tableNames?.join(", ") || "Unknown"}`)

    // Get API key (user-provided or server key)
    const apiKey = getOpenAIKey(request);
    if (!apiKey) {
      // If no API key available, use fallback descriptions
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
      return NextResponse.json({
        success: true,
        schema: enhancedSchema,
        rateLimit: {
          remaining: rateLimitResult.remaining,
          limit: rateLimitResult.limit,
        },
      })
    }

    const client = new OpenAI({
      apiKey: apiKey
    })

    const enhancedSchema = { ...schema }

    async function callOpenAIWithRetry(prompt: string, retries = 3): Promise<string | null> {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          console.log(`OpenAI API call attempt ${attempt}/${retries}`)

          const response = await client.responses.create({
            model: process.env.OPENAI_MODEL || "gpt-5",
            input: [
              {
                role: "user",
                content: prompt
              }
            ]
          })

          if (response.status === "completed") {
            return response.output_text?.trim() || null
          } else if (response.status === "failed" && response.error?.code === "rate_limit_exceeded") {
            // Rate limited - wait longer before retry
            const waitTime = Math.pow(2, attempt) * 2000 // 4s, 8s, 16s
            console.log(`Rate limited, waiting ${waitTime}ms before retry`)
            await new Promise((resolve) => setTimeout(resolve, waitTime))
            continue
          } else {
            console.error(`OpenAI API error:`, response.status, response.error?.message)
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

        const aiDescription = await callOpenAIWithRetry(tablePrompt)
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

          const aiDescription = await callOpenAIWithRetry(columnPrompt)
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

    return NextResponse.json({
      success: true,
      schema: enhancedSchema,
      rateLimit: {
        remaining: rateLimitResult.remaining,
        limit: rateLimitResult.limit,
      },
    })
  } catch (error) {
    console.error("Error processing AI descriptions:", error)
    return NextResponse.json({ success: false, error: "Failed to generate descriptions" }, { status: 500 })
  }
}
