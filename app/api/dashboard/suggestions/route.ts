import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { checkRateLimit, getOpenAIKey } from "@/utils/rate-limiter"

export async function POST(request: NextRequest) {
  try {
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

    const { connectionId, vectorStoreId } = await request.json()

    console.log("Generating suggestions for connection:", connectionId, "with vectorStoreId:", vectorStoreId);

    if (!connectionId || !vectorStoreId) {
      console.error("Missing required parameters:", { connectionId, vectorStoreId });
      return NextResponse.json(
        {
          error: "Connection ID and Vector Store Id data required",
          message: "Please pass both connectionId and vectorStoreId in request body",
        },
        { status: 400 },
      )
    }

    // Get API key (user-provided or server key)
    const apiKey = getOpenAIKey(request);
    if (!apiKey) {
      console.error("OPENAI_API_KEY is not configured");
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 500 },
      )
    }

    const prompt = `Use the uploaded database schema file information in the vector store to create your suggestions.`;

    const client = new OpenAI({
      apiKey: apiKey
    });

    console.log("Calling OpenAI Responses API with model:", process.env.OPENAI_MODEL);

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      tools: [{
        type: "file_search",
        vector_store_ids: [vectorStoreId]
      }],
      input: [
        {
          role: "system",
          content:
            `
            # Role
            You are a business intelligence expert. Create practical suggestions and identify exactly which database tables each query would need.

            # INSTRUCTIONS
            Based on the database schema found in the uploaded file identified as the database schema file, suggest 6 valuable business metrics, reports, or analyses. For each suggestion, identify which specific tables would be needed.

            For each suggestion, provide:
            1. A clear title
            2. A brief description of what insight it provides
            3. A natural language query that could generate this metric
            4. A category (Performance, Customer, Financial, Operational, etc.)
            5. An array of relevant table names that would be needed for this query

            Format as JSON array with objects containing: title, description, query, category, relevantTables

            # CRITICAL INSTRUCTIONS - DO NOT DEVIATE!!!
            1. Use only table names and columns found in the supplied schema file.
            2. NEVER guess column or table names
            `,
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt
            }
          ],
        },
      ]
    })

    console.log("OpenAI response status:", response.status)

    if (response.status !== "completed") {
      const errorText = response.error?.message;
      console.error("OpenAI API error:", {
        status: response.status,
        statusText: response.error?.code,
        body: errorText,
      })
      return NextResponse.json({ error: `OpenAI API request failed: ${response.status} ${response.error?.message} - ${errorText}` }, { status: 500 });
    }

    let suggestions
    try {
      suggestions = JSON.parse(response.output_text);
      suggestions = suggestions.map((suggestion: any) => ({
        ...suggestion,
        relevantTables: suggestion.relevantTables || [],
      }));
    } catch (parseError) {
        console.error("Error generating suggestions:", parseError);
        console.info("OpenAI API response:", response.output_text);
        suggestions = [];
    }

    return NextResponse.json({
      suggestions,
      rateLimit: {
        remaining: rateLimitResult.remaining,
        limit: rateLimitResult.limit,
      },
    })
  } catch (error: any) {
    console.error("Error generating suggestions:", error)
    console.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      cause: error?.cause
    });

    // Check if this is a vector store not found error
    const errorMessage = error?.message || "";
    if (errorMessage.includes("Vector store") && errorMessage.includes("not found")) {
      console.log("Vector store not found - needs re-upload");
      return NextResponse.json({
        error: "VECTOR_STORE_NOT_FOUND",
        details: "The vector store for this connection no longer exists and needs to be re-uploaded.",
        needsReupload: true
      }, { status: 404 })
    }

    return NextResponse.json({
      error: "Failed to generate suggestions",
      details: error?.message || "Unknown error"
    }, { status: 500 })
  }
}
