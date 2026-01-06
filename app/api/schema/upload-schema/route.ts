import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai";
import { uploadSchemaToOpenAI } from "@/lib/openai/schema-upload";

export async function POST(request: NextRequest) {
  try {
    const { data, existingFileId, existingVectorStoreId } = await request.json();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const result = await uploadSchemaToOpenAI(data, openai, {
      existingFileId,
      existingVectorStoreId
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("An error occurred while attempting to update database schema file:", error);
    return NextResponse.json({ error: "Failed to upload schema file" }, { status: 500 });
  }
}
