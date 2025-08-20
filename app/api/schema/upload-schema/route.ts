import { type NextRequest, NextResponse } from "next/server"
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
    try {
        const { data, existingFileId, existingVectorStoreId } = await request.json();
        const jsonFile = new File([JSON.stringify(data, null, 2)], 'database-schema.json', {
            type: 'application/json'
        });

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        if (!!existingFileId) {
            await openai.files.delete(existingFileId);
        }
        
        if (!!existingVectorStoreId) {
            await openai.files.delete(existingVectorStoreId);
        }

        const file = await openai.files.create({
            file: jsonFile,
            purpose: 'user_data'
        });
        const vectorStore = await openai.vectorStores.create({
            name: "Database schema store",
            file_ids: [file.id]
        });
        return NextResponse.json({ fileId: file.id, vectorStoreId: vectorStore.id });
    } catch (error)
    {
        console.error("An error ocurrred while attempting to update database schema file:", error);
        return NextResponse.json({ error: "Failed to upload schema file" }, { status: 500 });
    }
}