import { getAppDb } from '../pool';

interface DbSchema {
  id: string;
  connection_id: string;
  owner_id: string;
  schema_data: DatabaseTable[];
  created_at: Date;
  updated_at: Date;
}

export async function getSchemaForConnection(
  connectionId: string,
  userId: string
): Promise<Schema | null> {
  const sql = getAppDb()!;

  const [row] = await sql<DbSchema[]>`
    SELECT * FROM connection_schemas
    WHERE connection_id = ${connectionId} AND owner_id = ${userId}
  `;

  if (!row) return null;

  return {
    connectionId: row.connection_id,
    tables: row.schema_data,
  };
}

export async function upsertSchema(
  userId: string,
  schema: Schema
): Promise<void> {
  const sql = getAppDb()!;

  await sql`
    INSERT INTO connection_schemas (connection_id, owner_id, schema_data)
    VALUES (${schema.connectionId}, ${userId}, ${JSON.stringify(schema.tables)})
    ON CONFLICT (connection_id, owner_id) DO UPDATE SET
      schema_data = EXCLUDED.schema_data
  `;
}

export async function getAllSchemasForUser(userId: string): Promise<Schema[]> {
  const sql = getAppDb()!;

  const rows = await sql<DbSchema[]>`
    SELECT * FROM connection_schemas WHERE owner_id = ${userId}
  `;

  return rows.map(row => ({
    connectionId: row.connection_id,
    tables: row.schema_data,
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
