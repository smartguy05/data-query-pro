// Standalone OpenAI schema upload for the eval harness.
//
// Mirrors lib/openai/schema-upload.ts (hidden-item filtering, file name,
// purpose, vector store name) but is intentionally NOT imported from the app
// so evals/ stays decoupled — and it ADDS the ingestion wait the app util
// lacks: polling the vector store's files until every file is "completed".

import OpenAI from "openai";

interface EvalSchemaColumn extends Record<string, unknown> {
  hidden?: boolean;
}

interface EvalSchemaTable extends Record<string, unknown> {
  hidden?: boolean;
  columns: EvalSchemaColumn[];
}

type EvalSchema = { tables: EvalSchemaTable[] } & Record<string, unknown>;

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 90_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Filters out hidden tables and columns, exactly like the app util. */
function filterHiddenItems(schemaData: EvalSchema): EvalSchema {
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

/** Best-effort file delete; logs and swallows failures. */
async function bestEffortDeleteFile(client: OpenAI, fileId: string): Promise<void> {
  try {
    await client.files.delete(fileId);
    console.log(`[eval:openai] Deleted file: ${fileId}`);
  } catch (error) {
    console.warn(
      `[eval:openai] Unable to delete file ${fileId}:`,
      error instanceof Error ? error.message : error
    );
  }
}

/** Best-effort vector store delete; logs and swallows failures. */
async function bestEffortDeleteVectorStore(client: OpenAI, vectorStoreId: string): Promise<void> {
  try {
    await client.vectorStores.delete(vectorStoreId);
    console.log(`[eval:openai] Deleted vector store: ${vectorStoreId}`);
  } catch (error) {
    console.warn(
      `[eval:openai] Unable to delete vector store ${vectorStoreId}:`,
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Polls the vector store's files every 2s until every file has status
 * "completed". Throws (listing statuses) if any file is "failed" or if
 * ingestion has not completed within 90s.
 */
async function waitForIngestion(client: OpenAI, vectorStoreId: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  for (;;) {
    const page = await client.vectorStores.files.list(vectorStoreId);
    const files = page.data;
    const statuses = files.map((f) => `${f.id}=${f.status}`).join(", ");

    if (files.some((f) => f.status === "failed")) {
      throw new Error(
        `Vector store ${vectorStoreId} ingestion failed. File statuses: ${statuses}`
      );
    }

    if (files.length > 0 && files.every((f) => f.status === "completed")) {
      return;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out after ${POLL_TIMEOUT_MS / 1000}s waiting for vector store ${vectorStoreId} ingestion. File statuses: ${statuses || "(no files listed)"}`
      );
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Uploads a database schema to OpenAI, creates a vector store containing it,
 * and waits for ingestion to complete before returning.
 *
 * On vector-store creation failure, best-effort deletes the orphaned file
 * and rethrows.
 */
export async function uploadSchemaForEval(
  client: OpenAI,
  schema: unknown
): Promise<{ fileId: string; vectorStoreId: string }> {
  const filteredData = filterHiddenItems(schema as EvalSchema);

  const jsonFile = new File(
    [JSON.stringify(filteredData, null, 2)],
    "database-schema.json",
    { type: "application/json" }
  );

  const file = await client.files.create({
    file: jsonFile,
    purpose: "user_data"
  });

  console.log(`[eval:openai] Created file: ${file.id}`);

  let vectorStore;
  try {
    vectorStore = await client.vectorStores.create({
      name: "Database schema store",
      file_ids: [file.id]
    });
  } catch (error) {
    console.error("[eval:openai] Failed to create vector store, cleaning up orphaned file...");
    await bestEffortDeleteFile(client, file.id);
    throw error;
  }

  console.log(`[eval:openai] Created vector store: ${vectorStore.id}; waiting for ingestion...`);

  await waitForIngestion(client, vectorStore.id);

  console.log(`[eval:openai] Vector store ${vectorStore.id} ingestion completed`);

  return {
    fileId: file.id,
    vectorStoreId: vectorStore.id
  };
}

/**
 * Best-effort parallel cleanup of eval OpenAI resources. Failures are logged
 * via console.warn; never throws.
 */
export async function cleanupEvalResources(
  client: OpenAI,
  fileId?: string,
  vectorStoreId?: string
): Promise<void> {
  const tasks: Promise<void>[] = [];
  if (vectorStoreId) {
    tasks.push(bestEffortDeleteVectorStore(client, vectorStoreId));
  }
  if (fileId) {
    tasks.push(bestEffortDeleteFile(client, fileId));
  }
  await Promise.all(tasks);
}
