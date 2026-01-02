import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    console.log("Starting query revision...");
    const {
      originalQuestion,
      generatedSql,
      errorMessage,
      databaseType,
      vectorStoreId,
      schemaData,
      existingFileId
    } = await request.json();

    console.log("Original question:", originalQuestion);
    console.log("Failed SQL:", generatedSql);
    console.log("Error message:", errorMessage);

    if (!generatedSql || !errorMessage) {
      return NextResponse.json(
        { error: "SQL and error message are required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 400 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Build the request with or without vector store
    const tools: any[] = vectorStoreId ? [{
      type: "file_search",
      vector_store_ids: [vectorStoreId]
    }] : [];

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL,
      tools: tools.length > 0 ? tools : undefined,
      input: [
        {
          role: "system",
          content: `
            # Role
            You are a SQL debugging expert. Your task is to fix SQL queries that have failed execution.
            Database type: ${databaseType || 'postgresql'}

            # CRITICAL: Schema Validation Process
            Before fixing the SQL, you MUST:
            1. Search the uploaded database schema file using file_search
            2. Verify that all table names and column names in the failed query ACTUALLY EXIST in the schema
            3. If a table/column doesn't exist, find the CORRECT name from the schema
            4. NEVER invent or guess table/column names - only use what's in the schema
            5. The error is often caused by incorrect table/column names that don't match the schema

            # Common Error Fixes
            1. "relation does not exist" - table name is wrong, find correct name in schema
            2. "column does not exist" - column name is wrong, find correct name in schema
            3. Syntax errors - fix SQL syntax while preserving intent
            4. Data type mismatches - cast values appropriately
            5. Ambiguous column references - add table aliases

            # SQL Rules
            1. Only generate SELECT statements for safety
            2. Fix the specific error while preserving the original query intent
            3. Use the EXACT casing of table and column names as they appear in the schema
            4. Use proper JOIN syntax when needed

            # Confidence Scoring
            - 0.9-1.0: Found and fixed the issue, all schema elements verified
            - 0.7-0.8: Fixed the issue, schema elements verified
            - 0.5-0.6: Attempted fix, some uncertainty
            - 0.3-0.4: Could not verify all schema elements
            - 0.1-0.2: Unable to confidently fix the query

            # Response Format
            Respond ONLY with a valid JSON object. No explanatory text outside the JSON.

            {
              "sql": "the corrected SQL query using ONLY verified schema elements",
              "explanation": "what was wrong and what was fixed (e.g., 'Changed table name from X to Y')",
              "confidence": 0.8,
              "warnings": ["any remaining concerns or unverified elements"]
            }`,
        },
        {
          role: 'user',
          content: `Please fix this SQL query that failed execution.

IMPORTANT: First search the database schema file to verify the correct table and column names before fixing.

Original user request: ${originalQuestion || 'Not provided'}

Failed SQL:
\`\`\`sql
${generatedSql}
\`\`\`

Error message:
${errorMessage}

Search the schema file and provide a corrected SQL query using only verified table and column names.`
        }
      ]
    });

    console.log("OpenAI response status:", response.status);

    if (response.status !== "completed") {
      console.error("OpenAI API error:", {
        status: response.status,
        error: response.error,
      });
      return NextResponse.json(
        { error: `OpenAI API request failed: ${response.status} ${response.error?.message}` },
        { status: 500 }
      );
    }

    const output = response.output_text;
    console.log("OpenAI response content:", output);

    try {
      let jsonContent = output;

      // If response contains "JSON:" followed by a code block, extract just the JSON part
      const jsonMatch = output?.match(/JSON:\s*```json\s*([\s\S]*?)\s*```/i);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
        console.log("Extracted JSON from mixed response");
      }

      const result = JSON.parse(jsonContent);
      console.log("Successfully parsed JSON response");

      return NextResponse.json(result);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError);
      console.error("Raw content was:", output);

      let extractedSQL = null;
      let explanation = "OpenAI returned a non-JSON response.";
      let confidence = 0.2;
      let warnings: string[] = [];

      // Try to extract JSON from mixed response first
      const jsonBlockMatch = output?.match(/```json\s*([\s\S]*?)\s*```/i);
      if (jsonBlockMatch) {
        try {
          const jsonResult = JSON.parse(jsonBlockMatch[1].trim());
          return NextResponse.json(jsonResult);
        } catch (e) {
          console.log("Found JSON block but couldn't parse it");
        }
      }

      // Try to extract SQL from code blocks
      const sqlMatch = output?.match(/```sql\s*([\s\S]*?)\s*```/i);
      if (sqlMatch) {
        extractedSQL = sqlMatch[1].trim();
        console.log("Extracted SQL from code block:", extractedSQL);
      } else {
        // Try to find SELECT statements
        const selectMatch = output?.match(/SELECT[\s\S]*?(?=\n\n|\n$|$)/i);
        if (selectMatch) {
          extractedSQL = selectMatch[0].trim();
          console.log("Extracted SQL from SELECT statement:", extractedSQL);
        }
      }

      // Try to extract explanation from the response
      const explanationMatch = output?.match(/(?:fix|correct|change|issue|problem).*?[.!]/i);
      if (explanationMatch) {
        explanation = explanationMatch[0].trim();
      }

      const fallbackResult = {
        sql: extractedSQL || generatedSql,
        explanation: extractedSQL ? explanation : "Could not generate a corrected query",
        confidence: extractedSQL ? confidence : 0.1,
        warnings: extractedSQL
          ? [`Could not parse OpenAI response as JSON. Raw response: ${output?.substring(0, 200)}...`]
          : ["Failed to generate a corrected query. Please try modifying the SQL manually."],
      };

      return NextResponse.json(fallbackResult);
    }
  } catch (error: any) {
    console.error("Error in query revision:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    return NextResponse.json(
      { error: error.message || "Failed to revise query" },
      { status: 500 }
    );
  }
}
