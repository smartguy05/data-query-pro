import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export async function POST(request: NextRequest) {
  try {
    const { connectionId, vectorStoreId } = await request.json()

    if (!connectionId || !vectorStoreId) {
      return NextResponse.json(
        {
          error: "Connection ID and Vector Store Id data required",
          message: "Please pass both connectionId and vectorStoreId in request body",
        },
        { status: 400 },
      )
    }

    const prompt = `Use the uploaded database schema file information in the vector store to create your suggestions.`;

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL,
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

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("Error generating suggestions:", error)
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 })
  }
}
