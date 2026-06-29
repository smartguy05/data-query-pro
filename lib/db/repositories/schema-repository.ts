import { getAppDb } from '../pool';
import type { Schema } from '@/models/schema.interface';
import type { DatabaseTable } from '@/models/database-table.interface';

interface DbSchema {
  id: string;
  connection_id: string;
  owner_id: string;
  schema_name: string;
  schema_data: DatabaseTable[] | string;
  schema_file_id: string | null;
  vector_store_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const DEFAULT_SCHEMA = 'public';

/** Handle data that may have been double-serialized (stored as JSON string in JSONB) */
function parseTables(data: DatabaseTable[] | string): DatabaseTable[] {
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return []; }
  }
  return [];
}

function toSchema(row: DbSchema): Schema {
  return {
    connectionId: row.connection_id,
    schema: row.schema_name,
    tables: parseTables(row.schema_data),
    schemaFileId: row.schema_file_id ?? undefined,
    vectorStoreId: row.vector_store_id ?? undefined,
  };
}

/**
 * Fetches one connection's schema for a specific namespace. When `schemaName` is
 * omitted, returns the most recently updated namespace (back-compat with callers
 * that predate multi-schema support).
 */
export async function getSchemaForConnection(
  connectionId: string,
  userId: string,
  schemaName?: string
): Promise<Schema | null> {
  const sql = getAppDb()!;

  // First try the user's own schema
  const own = schemaName
    ? await sql<DbSchema[]>`
        SELECT * FROM connection_schemas
        WHERE connection_id = ${connectionId} AND owner_id = ${userId} AND schema_name = ${schemaName}
        LIMIT 1
      `
    : await sql<DbSchema[]>`
        SELECT * FROM connection_schemas
        WHERE connection_id = ${connectionId} AND owner_id = ${userId}
        ORDER BY updated_at DESC
        LIMIT 1
      `;

  if (own[0]) {
    return toSchema(own[0]);
  }

  // For server connections, fall back to any schema (e.g. admin-uploaded)
  const shared = schemaName
    ? await sql<DbSchema[]>`
        SELECT cs.* FROM connection_schemas cs
        JOIN database_connections dc ON dc.id = cs.connection_id
        WHERE cs.connection_id = ${connectionId} AND dc.source = 'server' AND cs.schema_name = ${schemaName}
        ORDER BY cs.updated_at DESC
        LIMIT 1
      `
    : await sql<DbSchema[]>`
        SELECT cs.* FROM connection_schemas cs
        JOIN database_connections dc ON dc.id = cs.connection_id
        WHERE cs.connection_id = ${connectionId} AND dc.source = 'server'
        ORDER BY cs.updated_at DESC
        LIMIT 1
      `;

  if (!shared[0]) return null;

  return toSchema(shared[0]);
}

export async function upsertSchema(
  userId: string,
  schema: Schema
): Promise<void> {
  const sql = getAppDb()!;
  const schemaName = schema.schema || DEFAULT_SCHEMA;

  await sql`
    INSERT INTO connection_schemas (connection_id, owner_id, schema_name, schema_data, schema_file_id, vector_store_id)
    VALUES (
      ${schema.connectionId},
      ${userId},
      ${schemaName},
      ${sql.json(schema.tables as unknown as Parameters<typeof sql.json>[0])},
      ${schema.schemaFileId ?? null},
      ${schema.vectorStoreId ?? null}
    )
    ON CONFLICT (connection_id, owner_id, schema_name) DO UPDATE SET
      schema_data = EXCLUDED.schema_data,
      schema_file_id = EXCLUDED.schema_file_id,
      vector_store_id = EXCLUDED.vector_store_id
  `;
}

export async function getAllSchemasForUser(userId: string): Promise<Schema[]> {
  const sql = getAppDb()!;

  // User's own schemas (one row per (connection, namespace))
  const ownRows = await sql<DbSchema[]>`
    SELECT * FROM connection_schemas WHERE owner_id = ${userId}
  `;

  // Server connection schemas (uploaded by any user, e.g. admin). Include a
  // server (connection, namespace) only if the user has no own copy of it.
  const serverRows = await sql<DbSchema[]>`
    SELECT DISTINCT ON (cs.connection_id, cs.schema_name) cs.*
    FROM connection_schemas cs
    JOIN database_connections dc ON dc.id = cs.connection_id
    WHERE dc.source = 'server'
      AND NOT EXISTS (
        SELECT 1 FROM connection_schemas o
        WHERE o.owner_id = ${userId}
          AND o.connection_id = cs.connection_id
          AND o.schema_name = cs.schema_name
      )
    ORDER BY cs.connection_id, cs.schema_name, cs.updated_at DESC
  `;

  return [...ownRows, ...serverRows].map(toSchema);
}

export async function deleteSchemaForConnection(
  connectionId: string,
  userId: string
): Promise<void> {
  const sql = getAppDb()!;
  await sql`
    DELETE FROM connection_schemas
    WHERE connection_id = ${connectionId} AND owner_id = ${userId}
  `;
}
