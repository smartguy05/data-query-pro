import { getAppDb } from '../pool';

interface DbSchema {
  id: string;
  connection_id: string;
  owner_id: string;
  schema_data: DatabaseTable[] | string;
  created_at: Date;
  updated_at: Date;
}

/** Handle data that may have been double-serialized (stored as JSON string in JSONB) */
function parseTables(data: DatabaseTable[] | string): DatabaseTable[] {
  if (Array.isArray(data)) return data;
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return []; }
  }
  return [];
}

export async function getSchemaForConnection(
  connectionId: string,
  userId: string
): Promise<Schema | null> {
  const sql = getAppDb()!;

  // First try the user's own schema
  const [own] = await sql<DbSchema[]>`
    SELECT * FROM connection_schemas
    WHERE connection_id = ${connectionId} AND owner_id = ${userId}
  `;

  if (own) {
    return { connectionId: own.connection_id, tables: parseTables(own.schema_data) };
  }

  // For server connections, fall back to any schema (e.g. admin-uploaded)
  const [shared] = await sql<DbSchema[]>`
    SELECT cs.* FROM connection_schemas cs
    JOIN database_connections dc ON dc.id = cs.connection_id
    WHERE cs.connection_id = ${connectionId} AND dc.source = 'server'
    ORDER BY cs.updated_at DESC
    LIMIT 1
  `;

  if (!shared) return null;

  return { connectionId: shared.connection_id, tables: parseTables(shared.schema_data) };
}

export async function upsertSchema(
  userId: string,
  schema: Schema
): Promise<void> {
  const sql = getAppDb()!;

  await sql`
    INSERT INTO connection_schemas (connection_id, owner_id, schema_data)
    VALUES (${schema.connectionId}, ${userId}, ${sql.json(schema.tables)})
    ON CONFLICT (connection_id, owner_id) DO UPDATE SET
      schema_data = EXCLUDED.schema_data
  `;
}

export async function getAllSchemasForUser(userId: string): Promise<Schema[]> {
  const sql = getAppDb()!;

  // User's own schemas
  const ownRows = await sql<DbSchema[]>`
    SELECT * FROM connection_schemas WHERE owner_id = ${userId}
  `;

  const ownConnectionIds = new Set(ownRows.map(r => r.connection_id));

  // Server connection schemas (uploaded by any user, e.g. admin)
  // Only include if user doesn't already have their own copy
  const serverRows = await sql<DbSchema[]>`
    SELECT DISTINCT ON (cs.connection_id) cs.*
    FROM connection_schemas cs
    JOIN database_connections dc ON dc.id = cs.connection_id
    WHERE dc.source = 'server'
      AND cs.connection_id NOT IN (SELECT connection_id FROM connection_schemas WHERE owner_id = ${userId})
    ORDER BY cs.connection_id, cs.updated_at DESC
  `;

  return [...ownRows, ...serverRows].map(row => ({
    connectionId: row.connection_id,
    tables: parseTables(row.schema_data),
  }));
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
