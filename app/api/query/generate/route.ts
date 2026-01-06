import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai";
import { checkRateLimit, getOpenAIKey } from "@/utils/rate-limiter";
import { uploadSchemaToOpenAI } from "@/lib/openai/schema-upload";

// SQL dialect-specific hints for different database types
const dialectHints: Record<string, string> = {
  postgresql: `
    - Use ILIKE for case-insensitive pattern matching
    - Use LIMIT/OFFSET for pagination
    - Use :: for type casting (e.g., column::text)
    - Use NOW() for current timestamp
    - String concatenation uses || operator
    - Use COALESCE for null handling`,
  mysql: `
    - Use LOWER() with LIKE for case-insensitive matching
    - Use LIMIT/OFFSET for pagination
    - Use backticks for identifier quoting if needed
    - Use NOW() for current timestamp
    - String concatenation uses CONCAT() function
    - Use IFNULL or COALESCE for null handling`,
  sqlserver: `
    - Use TOP N instead of LIMIT (placed after SELECT, e.g., SELECT TOP 100)
    - Use OFFSET/FETCH for pagination (ORDER BY required)
    - Use square brackets [] for identifier quoting if needed
    - Use GETDATE() for current timestamp
    - String concatenation uses + operator
    - Use ISNULL or COALESCE for null handling
    - Date functions: DATEADD, DATEDIFF, CONVERT`,
  sqlite: `
    - LIKE is case-insensitive for ASCII characters by default
    - Use LIMIT/OFFSET for pagination
    - Use double quotes for identifier quoting if needed
    - Use datetime('now') for current timestamp
    - String concatenation uses || operator
    - Use IFNULL or COALESCE for null handling
    - Limited date functions: date(), time(), datetime(), strftime()`,
};

export async function POST(request: NextRequest) {
  try {
    console.log("Starting query generation...");

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

    const { query, databaseType, vectorStoreId, schemaData, existingFileId } = await request.json();
    console.log("Received query:", query);
    console.log("Received database type:", databaseType);
    console.log("Received VectorStore Id:", vectorStoreId);

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400})
    }

    // Get API key (user-provided or server key)
    const apiKey = getOpenAIKey(request);
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 400});
    }

    console.log("Making OpenAI API request...")
    const client = new OpenAI({
      apiKey: apiKey
    });

    let currentVectorStoreId = vectorStoreId;
    let newFileId: string | undefined;
    let newVectorStoreId: string | undefined;
    let retryAttempt = false;

    // Function to make the OpenAI request
    const makeOpenAIRequest = async (vsId: string) => {
      return await client.responses.create({
        model: process.env.OPENAI_MODEL,
        tools: [{
          type: "file_search",
          vector_store_ids: [vsId]
        }],
        input: [
          {
            role: "system",
            content: `
              # Role
              You are a SQL expert. Convert natural language queries to SQL using syntax for ${databaseType || 'postgresql'}.

              # MANDATORY: Schema-First Approach
              You have access to an uploaded database schema file via file_search. This schema is the ONLY source of truth for table and column names.

              ## STRICT REQUIREMENTS - VIOLATION IS NOT ALLOWED:
              1. You MUST search the schema file FIRST before writing any SQL
              2. You MUST ONLY use table names that EXACTLY match what appears in the schema file
              3. You MUST ONLY use column names that EXACTLY match what appears in the schema file for each table
              4. You MUST preserve the exact casing (uppercase/lowercase) as it appears in the schema
              5. You MUST NOT invent, guess, assume, or infer ANY table or column names
              6. You MUST NOT use common/typical column names (like "id", "name", "created_at") unless you verified they exist in the schema
              7. If the user asks for data that doesn't map to any schema element, respond with confidence 0.2 and explain what's missing

              ## COMMON MISTAKES TO AVOID:
              - Do NOT assume a table called "users" exists - search for it first
              - Do NOT assume columns like "id", "name", "email", "created_at" exist - verify each one
              - Do NOT guess foreign key column names - find them in the schema
              - Do NOT use singular/plural variations (e.g., "user" vs "users") - use EXACT schema name
              - Do NOT use snake_case if schema uses camelCase or vice versa

              ## VERIFICATION PROCESS:
              Before generating SQL, mentally verify:
              - "Did I find this exact table name in the schema?"
              - "Did I find this exact column name in this specific table?"
              - "Am I using the exact casing from the schema?"

              # SQL Generation Rules
              1. Only generate SELECT statements for safety
              2. Use proper JOIN syntax when needed
              3. Include appropriate WHERE clauses for filtering
              4. Use LIMIT for large result sets (default to LIMIT 100 if not specified)
              5. Use table and column descriptions from the schema to understand business context
              6. Prefer meaningful column aliases for better readability
              7. Primary keys are often named "Id" (capitalized) - but VERIFY in schema first

              # Database-Specific Syntax (${databaseType || 'postgresql'})
              ${dialectHints[databaseType] || dialectHints['postgresql']}

              # Confidence Scoring (be honest!)
              - 0.9-1.0: Every table and column was explicitly found in schema search results
              - 0.7-0.8: All elements verified, but query logic is complex
              - 0.5-0.6: Most elements verified, some relationships assumed
              - 0.3-0.4: Some tables/columns could NOT be found in schema
              - 0.1-0.2: Unable to find required schema elements - query may fail

              # Response Format
              Respond ONLY with a valid JSON object. No explanatory text, markdown, or other content outside the JSON.

              {
                "sql": "the generated SQL query using ONLY verified schema elements",
                "explanation": "List the specific tables and columns used, confirming they were found in schema",
                "confidence": 0.8,
                "warnings": ["List any elements that could not be verified, or tables/columns the user asked for but don't exist"]
              }`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `IMPORTANT: Search the database schema file first, then generate a SQL query using ONLY the exact table and column names found in the schema.

User's request: ${query}

Remember: Every table and column in your SQL must exactly match what exists in the schema file. Do not guess or assume any names.`
              }
            ]
          }
        ]
      });
    };

    // Try to make the request, with retry logic for 404 vector store errors
    let response;
    try {
      response = await makeOpenAIRequest(currentVectorStoreId);
    } catch (error: any) {
      // Check if this is a 404 vector store error
      const errorMessage = error?.message || error?.toString() || "";
      const isVectorStore404 = errorMessage.includes("404") &&
                              errorMessage.includes("Vector store") &&
                              errorMessage.includes("not found");

      if (isVectorStore404 && schemaData) {
        console.log("Vector store not found (404), attempting to re-upload schema...");
        retryAttempt = true;

        try {
          // Re-upload the schema
          const uploadResult = await uploadSchemaToOpenAI(schemaData, client, {
            existingFileId,
            existingVectorStoreId: currentVectorStoreId
          });
          newFileId = uploadResult.fileId;
          newVectorStoreId = uploadResult.vectorStoreId;
          currentVectorStoreId = newVectorStoreId;

          console.log("Schema re-uploaded successfully. New vector store ID:", newVectorStoreId);

          // Retry the request with new vector store ID
          response = await makeOpenAIRequest(currentVectorStoreId);
        } catch (retryError) {
          console.error("Failed to re-upload schema and retry:", retryError);
          throw new Error("Vector store not found and schema re-upload failed");
        }
      } else {
        // Re-throw if it's not a vector store 404 error or we don't have schema data
        throw error;
      }
    }

    console.log("OpenAI response status:", response.status)

    if (response.status !== "completed") {
      const errorText = response.error?.message;
      console.error("OpenAI API error:", {
        status: response.status,
        statusText: response.error?.code,
        body: errorText,
      })
      return NextResponse.json({ error: `OpenAI API request failed: ${response.status} ${response.error?.message} - ${errorText}` }, { status: 500});
    }

    const output = response.output_text;
    console.log("OpenAI response content:", output);

    try {
      let jsonContent = output;

      // If response contains "JSON:" followed by a code block, extract just the JSON part
      const jsonMatch = output?.match(/JSON:\s*```json\s*([\s\S]*?)\s*```/i)
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim()
        console.log("Extracted JSON from mixed response")
      }

      const result = JSON.parse(jsonContent)
      console.log("Successfully parsed JSON response")

      // Include new IDs if schema was re-uploaded
      if (retryAttempt && newFileId && newVectorStoreId) {
        return NextResponse.json({
          ...result,
          newFileId,
          newVectorStoreId,
          schemaReuploaded: true,
          rateLimit: {
            remaining: rateLimitResult.remaining,
            limit: rateLimitResult.limit,
          },
        })
      }

      return NextResponse.json({
        ...result,
        rateLimit: {
          remaining: rateLimitResult.remaining,
          limit: rateLimitResult.limit,
        },
      })
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError)
      console.error("Raw content was:", output)

      let extractedSQL = null
      let explanation = "OpenAI returned a non-JSON response."
      let confidence = 0.2
      let warnings: any[] = []

      // Try to extract JSON from mixed response first
      const jsonMatch = output?.match(/```json\s*([\s\S]*?)\s*```/i)
      if (jsonMatch) {
        try {
          const jsonResult = JSON.parse(jsonMatch[1].trim())
          return NextResponse.json(jsonResult)
        } catch (e) {
          console.log("Found JSON block but couldn't parse it")
        }
      }

      // Try to extract SQL from code blocks
      const sqlMatch = output?.match(/```sql\s*([\s\S]*?)\s*```/i)
      if (sqlMatch) {
        extractedSQL = sqlMatch[1].trim()
        console.log("Extracted SQL from code block:", extractedSQL)
      } else {
        // Try to find SELECT statements
        const selectMatch = output?.match(/SELECT[\s\S]*?(?=\n\n|\n$|$)/i)
        if (selectMatch) {
          extractedSQL = selectMatch[0].trim()
          console.log("Extracted SQL from SELECT statement:", extractedSQL)
        }
      }

      // Try to extract explanation and confidence from the response
      const explanationMatch = output?.match(/Explanation:\s*(.*?)(?=\n|$)/i)
      if (explanationMatch) {
        explanation = explanationMatch[1].trim()
      }

      const confidenceMatch = output?.match(/Confidence:\s*([\d.]+)/i)
      if (confidenceMatch) {
        confidence = Number.parseFloat(confidenceMatch[1])
      }

      const warningsMatch = output?.match(/Warnings?:\s*(.*?)(?=\n\n|JSON:|$)/is)
      if (warningsMatch) {
        warnings = [warningsMatch[1].trim()]
      }

      const fallbackResult = {
        sql: extractedSQL || "SELECT 1 as parsing_error",
        explanation: explanation,
        confidence: confidence,
        warnings:
          warnings.length > 0
            ? warnings
            : [`Could not parse OpenAI response as JSON. Raw response: ${output?.substring(0, 200)}...`],
      };

      // Include new IDs if schema was re-uploaded
      if (retryAttempt && newFileId && newVectorStoreId) {
        return NextResponse.json({
          ...fallbackResult,
          newFileId,
          newVectorStoreId,
          schemaReuploaded: true,
          rateLimit: {
            remaining: rateLimitResult.remaining,
            limit: rateLimitResult.limit,
          },
        })
      }

      return NextResponse.json({
        ...fallbackResult,
        rateLimit: {
          remaining: rateLimitResult.remaining,
          limit: rateLimitResult.limit,
        },
      })
    }
  } catch (error: any) {
    console.error("Error in query generation (falling back to mock):", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    const mockResponse = {
      sql: `SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position
LIMIT 50`,
      explanation:
        "Shows database schema information - configure OpenAI API key and provide schema context for better queries",
      confidence: 0.3,
      warnings: [
        "This is a mock response - configure OpenAI API key and ensure schema is loaded for real functionality",
      ],
    }

    return NextResponse.json(mockResponse)
  }
}

