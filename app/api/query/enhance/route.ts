import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai";
import { checkRateLimit, getOpenAIKey } from "@/utils/rate-limiter";
import { getAuthContext } from '@/lib/auth/require-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    console.log("Starting query enhancement...");

    // Check rate limit first
    const rateLimitResult = checkRateLimit(request);
    if (!rateLimitResult.allowed) {
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

    const {
      query,
      vectorStoreId,
      databaseType
    } = await request.json();

    console.log("Original query:", query);

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Get API key (user-provided or server key)
    const apiKey = getOpenAIKey(request);
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 400 }
      );
    }

    const client = new OpenAI({
      apiKey: apiKey
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
            You are a database query expert who helps users write better natural language queries for SQL generation.
            Your task is to take a user's query, understand their intent, and produce a well-structured enhanced query.

            # CRITICAL: Schema Validation - READ THIS FIRST
            Before writing ANY enhanced query, you MUST:
            1. Search the uploaded database schema file using file_search
            2. List out the EXACT table names that exist in the schema
            3. List out the EXACT column names for each relevant table
            4. ONLY reference tables and columns that you have VERIFIED exist in the schema
            5. NEVER invent, guess, or assume column names - if you didn't find it in the schema, don't use it
            6. Use the EXACT spelling and casing of table/column names as they appear in the schema

            # STRICT RULES
            - Do NOT use generic column names unless they EXACTLY match the schema
            - Do NOT assume common column naming conventions - always verify against the actual schema
            - If you cannot find relevant columns, keep that part general rather than inventing column names

            # Output Format
            The enhanced query MUST follow this two-part structure:

            **Goal:** [1-2 sentences explaining the business intent/purpose - what insight or information the user is trying to get, and why it matters. Reference the specific tables and columns that will provide this insight using table_name.column_name format]

            **Query:** [Detailed implementation instructions including:
            - Which tables to join and how (specify join conditions like table_a.column = table_b.column)
            - What columns to select or aggregate
            - How to group results if needed
            - Any calculations or formulas to compute
            - Filtering conditions
            - What to display vs what to use only for joining
            - Sorting preferences if relevant]

            # Example Output Format
            "Goal: Measure pricing efficiency by comparing billed totals to billable hours per trip and rolling up by product using flight_plan_bills.total and flight_plan_bills.hours joined to the trip's product via flight_plans.product_id. Query: Join flight_plan_bills to flight_plans on flight_plan_bills.flight_plan_id = flight_plans.id, then group by flight_plans.product_id. Compute average rate = SUM(flight_plan_bills.total) / NULLIF(SUM(flight_plan_bills.hours), 0) for each group. Display the product name instead of product id by joining to products table."

            # Response Format
            Respond ONLY with a valid JSON object. No explanatory text outside the JSON.

            {
              "enhancedQuery": "Goal: [business intent with table.column references]. Query: [detailed implementation instructions]",
              "improvements": ["list of specific improvements made"],
              "tablesReferenced": ["list of VERIFIED table names from schema"],
              "columnsReferenced": ["list of VERIFIED column names used in the enhanced query"]
            }`,
        },
        {
          role: 'user',
          content: `Please enhance this natural language query by understanding the user's intent and producing a structured response.

STEP 1: First, search the database schema file and identify:
- The exact table names available
- The exact column names in each relevant table
- How tables relate to each other (foreign keys, join columns)

STEP 2: Understand the user's intent - what business question are they trying to answer?

STEP 3: Produce an enhanced query in this format:
"Goal: [explain the business intent and what insight they're seeking, referencing specific table.column names]. Query: [provide detailed implementation instructions with specific join conditions, aggregations, groupings, and display preferences]"

Original query: "${query}"

IMPORTANT RULES:
- ONLY use table and column names that exist in the schema
- Use table_name.column_name format when referencing columns
- Specify exact join conditions (e.g., "join table_a to table_b on table_a.id = table_b.foreign_id")
- If displaying human-readable values, mention joining to lookup tables (e.g., "display product name instead of product_id by joining to products")
- Include any relevant filtering, grouping, or sorting instructions`
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

      // Try to extract JSON from code blocks if present
      const jsonMatch = output?.match(/```json\s*([\s\S]*?)\s*```/i);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
        console.log("Extracted JSON from code block");
      }

      const result = JSON.parse(jsonContent);
      console.log("Successfully parsed JSON response");

      return NextResponse.json(result);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError);
      console.error("Raw content was:", output);

      // Try to extract the enhanced query from the response text
      let enhancedQuery = query;

      // Look for quoted text that might be the enhanced query
      const quotedMatch = output?.match(/"([^"]{20,})"/);
      if (quotedMatch) {
        enhancedQuery = quotedMatch[1];
      }

      return NextResponse.json({
        enhancedQuery: enhancedQuery,
        improvements: ["Could not parse full response"],
        tablesReferenced: [],
        warning: "Response parsing failed, enhancement may be incomplete"
      });
    }
  } catch (error: any) {
    console.error("Error in query enhancement:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    return NextResponse.json(
      { error: error.message || "Failed to enhance query" },
      { status: 500 }
    );
  }
}
