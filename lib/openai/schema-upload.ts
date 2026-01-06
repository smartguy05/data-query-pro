/**
 * Shared OpenAI schema upload utilities.
 *
 * Handles uploading database schema files to OpenAI for vector search,
 * including cleanup of existing resources and proper error handling.
 */

import OpenAI from "openai";
import type { Schema } from "@/models/schema.interface";

export interface SchemaUploadResult {
  fileId: string;
  vectorStoreId: string;
}

export interface SchemaUploadOptions {
  /** Existing file ID to delete before upload */
  existingFileId?: string;
  /** Existing vector store ID to delete before upload */
  existingVectorStoreId?: string;
}

/**
 * Filters out hidden tables and columns from schema data.
 * Hidden items should not be sent to OpenAI for context.
 */
function filterHiddenItems(schemaData: Schema): Schema {
  return {
    ...schemaData,
    tables: schemaData.tables
      .filter((table) => !table.hidden)
      .map((table) => ({
        ...table,
        columns: table.columns.filter((column) => !column.hidden)
      }))
  };
}

/**
 * Safely deletes an OpenAI file, handling errors gracefully.
 *
 * @param client - OpenAI client instance
 * @param fileId - ID of the file to delete
 * @returns true if deleted successfully, false otherwise
 */
export async function cleanupOpenAIFile(
  client: OpenAI,
  fileId: string
): Promise<boolean> {
  try {
    await client.files.delete(fileId);
    console.log(`[OpenAI] Deleted file: ${fileId}`);
    return true;
  } catch (error) {
    console.log(`[OpenAI] Unable to delete file ${fileId}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Safely deletes an OpenAI vector store, handling errors gracefully.
 *
 * @param client - OpenAI client instance
 * @param vectorStoreId - ID of the vector store to delete
 * @returns true if deleted successfully, false otherwise
 */
export async function cleanupOpenAIVectorStore(
  client: OpenAI,
  vectorStoreId: string
): Promise<boolean> {
  try {
    await client.vectorStores.delete(vectorStoreId);
    console.log(`[OpenAI] Deleted vector store: ${vectorStoreId}`);
    return true;
  } catch (error) {
    console.log(`[OpenAI] Unable to delete vector store ${vectorStoreId}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Cleans up existing OpenAI resources (file and vector store).
 * Errors are logged but do not throw - cleanup failures shouldn't block new uploads.
 *
 * @param client - OpenAI client instance
 * @param options - IDs of resources to cleanup
 */
export async function cleanupOpenAIResources(
  client: OpenAI,
  options: SchemaUploadOptions
): Promise<void> {
  const cleanupPromises: Promise<boolean>[] = [];

  if (options.existingFileId) {
    cleanupPromises.push(cleanupOpenAIFile(client, options.existingFileId));
  }

  if (options.existingVectorStoreId) {
    cleanupPromises.push(cleanupOpenAIVectorStore(client, options.existingVectorStoreId));
  }

  // Run cleanup in parallel
  await Promise.all(cleanupPromises);
}

/**
 * Uploads a database schema to OpenAI and creates a vector store for file search.
 *
 * This function:
 * 1. Filters out hidden tables and columns
 * 2. Cleans up existing file and vector store if provided
 * 3. Creates a new file with the schema data
 * 4. Creates a vector store containing the file
 *
 * If vector store creation fails after file creation, the orphaned file
 * is automatically cleaned up.
 *
 * @param schemaData - The database schema to upload
 * @param client - OpenAI client instance
 * @param options - Optional existing resource IDs to cleanup
 * @returns Object containing new fileId and vectorStoreId
 * @throws Error if upload fails
 */
export async function uploadSchemaToOpenAI(
  schemaData: Schema,
  client: OpenAI,
  options: SchemaUploadOptions = {}
): Promise<SchemaUploadResult> {
  // Filter out hidden tables and columns
  const filteredData = filterHiddenItems(schemaData);

  const jsonFile = new File(
    [JSON.stringify(filteredData, null, 2)],
    "database-schema.json",
    { type: "application/json" }
  );

  // Clean up existing resources (errors are logged but don't block)
  await cleanupOpenAIResources(client, options);

  // Create new file
  const file = await client.files.create({
    file: jsonFile,
    purpose: "user_data"
  });

  console.log(`[OpenAI] Created file: ${file.id}`);

  // Create vector store with the file
  // If this fails, clean up the orphaned file (Phase 2.4)
  let vectorStore;
  try {
    vectorStore = await client.vectorStores.create({
      name: "Database schema store",
      file_ids: [file.id]
    });
  } catch (error) {
    // Clean up the orphaned file we just created
    console.error("[OpenAI] Failed to create vector store, cleaning up orphaned file...");
    await cleanupOpenAIFile(client, file.id);
    throw error;
  }

  console.log(`[OpenAI] Created vector store: ${vectorStore.id}`);

  return {
    fileId: file.id,
    vectorStoreId: vectorStore.id
  };
}
