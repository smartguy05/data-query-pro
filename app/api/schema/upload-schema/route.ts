import { type NextRequest, NextResponse } from "next/server"
import OpenAI from 'openai';
import { withAuth } from "@/lib/auth/api-auth";

export const POST = withAuth(async (request, { user }) => {
    try {
        const { data, existingFileId, existingVectorStoreId } = await request.json();

        // Filter out hidden tables and hidden columns before uploading to OpenAI
        const filteredData = {
            ...data,
            tables: data.tables
                .filter((table: any) => !table.hidden) // Remove hidden tables
                .map((table: any) => ({
                    ...table,
                    columns: table.columns.filter((column: any) => !column.hidden) // Remove hidden columns
                }))
        };

        const jsonFile = new File([JSON.stringify(filteredData, null, 2)], 'database-schema.json', {
            type: 'application/json'
        });

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        try {
            if (!!existingFileId) {
                await openai.files.delete(existingFileId);
            }            
        } catch (e) {
            console.log("Unable to delete file store")
            console.error(e);
        }

        try {
            if (!!existingVectorStoreId) {
                await openai.vectorStores.delete(existingVectorStoreId);
            }            
        } catch (e) {
            console.log("Unable to delete vector store")
            console.error(e);
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
}, { requireAdmin: true })