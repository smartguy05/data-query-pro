import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai";

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

export async function POST(request: NextRequest) {
  try {
    console.log("Starting query generation...");
    const { query, databaseType, vectorStoreId, schemaData, existingFileId } = await request.json();
    console.log("Received query:", query);
    console.log("Received VectorStore Id:", vectorStoreId);

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400})
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 400});
    }

    console.log("Making OpenAI API request...")
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
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
              You are a SQL expert. Use the uploaded database schema file, mentioned in the user message, to convert natural language queries to SQL using syntax for ${databaseType}

              # Rules
              1. Only generate SELECT statements for safety
              2. Use proper JOIN syntax when needed
              3. Include appropriate WHERE clauses for filtering
              4. Use LIMIT for large result sets
              5. Validate that all referenced tables and columns exist in the schema
              6. Use table and column descriptions to understand business context
              7. Prefer meaningful column aliases for better readability
              8. IMPORTANT: ONLY USED CONFIRMED TABLES AND COLUMNS AS SUPPLIED ABOVE!!!
              9. Most tables have a Primary Key called Id

              # IMPORTANT!!!!
              - Respond ONLY with a valid JSON object.
              - Do not include any explanatory text, markdown, or other content outside the JSON.

              # Formatting
              Required JSON format:
              {
                "sql": "the generated SQL query",
                "explanation": "brief explanation of what the query does",
                "confidence": 0.8,
                "warnings": ["array of any potential issues"]
              }`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: query
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
          schemaReuploaded: true
        })
      }

      return NextResponse.json(result)
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
          schemaReuploaded: true
        })
      }

      return NextResponse.json(fallbackResult)
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

