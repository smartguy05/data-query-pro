// Typed fetch wrappers over the running dev server for the NL→SQL eval harness.
// Uses the global fetch (Node 20+); no app code imports — the harness is a
// standalone HTTP client of the API routes.

import type { DbConnectionConfig, ExecuteSuccess, GenerateResponse } from "../types";

const GENERATE_TIMEOUT_MS = 120_000;
const EXECUTE_TIMEOUT_MS = 60_000;
const INTROSPECT_TIMEOUT_MS = 60_000;

export interface TimedResponse<T> {
  status: number;
  body: T;
  ms: number;
}

export type ExecuteErrorBody = { error?: string; code?: string; detail?: string };

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

async function postJson(
  url: string,
  payload: unknown,
  timeoutMs: number
): Promise<{ status: number; body: unknown; ms: number }> {
  const start = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return { status: response.status, body, ms: Date.now() - start };
}

/**
 * POST /api/schema/introspect with a full no-auth-mode connection.
 * Returns the introspected schema object ({ tables: [...] }).
 * Throws on any non-success response.
 */
export async function introspectSchema(
  baseUrl: string,
  connection: DbConnectionConfig
): Promise<unknown> {
  const { status, body } = await postJson(
    joinUrl(baseUrl, "/api/schema/introspect"),
    { connection },
    INTROSPECT_TIMEOUT_MS
  );
  const parsed = body as { success?: boolean; schema?: unknown; error?: string };
  if (status !== 200 || !parsed.success || parsed.schema === undefined) {
    throw new Error(
      `Schema introspection failed (HTTP ${status}): ${parsed.error ?? "unknown error"}`
    );
  }
  return parsed.schema;
}

/**
 * POST /api/query/generate. Always postgresql dialect with defaultLimit "none".
 * Never throws on a non-200 response — the HTTP status is returned so the
 * caller can classify it (the route returns 500 when the OpenAI response
 * status !== "completed", and can return a 200 mock on internal errors).
 */
export async function generateSql(
  baseUrl: string,
  opts: {
    query: string;
    vectorStoreId: string;
    schemaData: unknown;
    model: string;
    /** Reasoning effort; omitted from the body when null/undefined. */
    effort?: string | null;
  }
): Promise<TimedResponse<GenerateResponse>> {
  const { status, body, ms } = await postJson(
    joinUrl(baseUrl, "/api/query/generate"),
    {
      query: opts.query,
      databaseType: "postgresql",
      vectorStoreId: opts.vectorStoreId,
      schemaData: opts.schemaData,
      model: opts.model,
      ...(opts.effort ? { effort: opts.effort } : {}),
      defaultLimit: "none",
    },
    GENERATE_TIMEOUT_MS
  );
  return { status, body: body as GenerateResponse, ms };
}

/**
 * POST /api/query/execute with a full no-auth-mode connection and
 * defaultLimit "none" (no injected row limit). Never throws on non-200:
 * 400 = validation rejection, 500 = execution error, body carries
 * { error, code, detail } in both failure cases.
 */
export async function executeSql(
  baseUrl: string,
  sql: string,
  connection: DbConnectionConfig
): Promise<TimedResponse<ExecuteSuccess | ExecuteErrorBody>> {
  const { status, body, ms } = await postJson(
    joinUrl(baseUrl, "/api/query/execute"),
    { sql, connection, defaultLimit: "none" },
    EXECUTE_TIMEOUT_MS
  );
  return { status, body: body as ExecuteSuccess | ExecuteErrorBody, ms };
}

/** Returns true when the dev server responds at baseUrl; never throws. */
export async function checkServerUp(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(joinUrl(baseUrl, "/"), {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });
    return response.status < 500;
  } catch {
    return false;
  }
}
