import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai";
import { checkRateLimit, getOpenAIKey } from "@/utils/rate-limiter";

// Helper function to upload schema and get new IDs
async function uploadSchemaToOpenAI(schemaData: any, client: OpenAI, existingFileId?: string, existingVectorStoreId?: string) {
  try {
    // Filter out hidden tables and columns
    const filteredData = {
      ...schemaData,
      tables: schemaData.tables
        .filter((table: any) => !table.hidden)
        .map((table: any) => ({
          ...table,
          columns: table.columns.filter((column: any) => !column.hidden)
        }))
    };

    const jsonFile = new File([JSON.stringify(filteredData, null, 2)], 'database-schema.json', {
      type: 'application/json'
    });

    // Try to delete existing file and vector store
    try {
      if (existingFileId) {
        await client.files.delete(existingFileId);
      }
    } catch (e) {
      console.log("Unable to delete existing file");
    }

    try {
      if (existingVectorStoreId) {
        await client.vectorStores.delete(existingVectorStoreId);
      }
    } catch (e) {
      console.log("Unable to delete existing vector store");
    }

    // Create new file and vector store
    const file = await client.files.create({
      file: jsonFile,
      purpose: 'user_data'
    });

    const vectorStore = await client.vectorStores.create({
      name: "Database schema store",
      file_ids: [file.id]
    });

    return { fileId: file.id, vectorStoreId: vectorStore.id };
  } catch (error) {
    console.error("Error uploading schema:", error);
    throw error;
  }
}

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

              # CRITICAL: Schema Validation Process
              Before generating ANY SQL, you MUST:
              1. Search the uploaded database schema file using file_search
              2. Identify the EXACT table names and column names from the schema
              3. ONLY use tables and columns that EXPLICITLY EXIST in the schema file
              4. NEVER invent, guess, or assume table/column names - if it's not in the schema, don't use it
              5. If you cannot find a required table or column in the schema, set confidence to 0.3 or lower and add a warning

              # SQL Generation Rules
              1. Only generate SELECT statements for safety
              2. Use proper JOIN syntax when needed
              3. Include appropriate WHERE clauses for filtering
              4. Use LIMIT for large result sets (default to LIMIT 100 if not specified)
              5. Use table and column descriptions from the schema to understand business context
              6. Prefer meaningful column aliases for better readability
              7. Most tables have a Primary Key called "Id"
              8. Use the exact casing of table and column names as they appear in the schema

              # Database-Specific Syntax (${databaseType || 'postgresql'})
              ${dialectHints[databaseType] || dialectHints['postgresql']}

              # Confidence Scoring
              - 0.9-1.0: All tables/columns verified in schema, straightforward query
              - 0.7-0.8: All tables/columns verified, complex joins or conditions
              - 0.5-0.6: Most elements verified, some uncertainty about relationships
              - 0.3-0.4: Some tables/columns could not be verified in schema
              - 0.1-0.2: Unable to find required schema elements

              # Response Format
              Respond ONLY with a valid JSON object. No explanatory text, markdown, or other content outside the JSON.

              {
                "sql": "the generated SQL query using ONLY verified schema elements",
                "explanation": "brief explanation including which tables/columns are being used",
                "confidence": 0.8,
                "warnings": ["list any tables/columns that could not be verified, or potential issues"]
              }`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Using the database schema from the uploaded file, generate a SQL query for: ${query}`
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
          const uploadResult = await uploadSchemaToOpenAI(schemaData, client, existingFileId, currentVectorStoreId);
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

