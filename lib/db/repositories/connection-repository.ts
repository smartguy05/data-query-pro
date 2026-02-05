import { getAppDb } from '../pool';
import { encryptPassword, decryptPassword } from '../encryption';

interface DbConnection {
  id: string;
  owner_id: string;
  name: string;
  type: string;
  host: string;
  port: string;
  database_name: string;
  username: string;
  password_enc: string;
  filepath: string | null;
  description: string | null;
  status: string;
  schema_file_id: string | null;
  vector_store_id: string | null;
  source: string;
  created_at: Date;
  updated_at: Date;
  // Join fields for shared connections
  permission?: string;
}

function toClientConnection(row: DbConnection): DatabaseConnection {
  return {
    id: row.id,
    name: row.name,
    type: row.type as DatabaseConnection['type'],
    host: row.host,
    port: row.port,
    database: row.database_name,
    username: row.username,
    password: '', // Never send password to client
    filepath: row.filepath || undefined,
    description: row.description || undefined,
    status: (row.status || 'disconnected') as 'connected' | 'disconnected',
    schemaFileId: row.schema_file_id || undefined,
    vectorStoreId: row.vector_store_id || undefined,
    source: (row.source || 'local') as 'local' | 'server',
    createdAt: row.created_at?.toISOString() || new Date().toISOString(),
  };
}

export async function getConnectionsForUser(
  userId: string,
  groups: string[] = []
): Promise<DatabaseConnection[]> {
  const sql = getAppDb()!;

  // Get owned connections
  const owned = await sql<DbConnection[]>`
    SELECT * FROM database_connections WHERE owner_id = ${userId}
    ORDER BY created_at DESC
  `;

  // Get shared connections
  const shared = await sql<DbConnection[]>`
    SELECT dc.*, cs.permission
    FROM database_connections dc
    JOIN connection_shares cs ON cs.connection_id = dc.id
    WHERE cs.shared_with_id = ${userId}
    ORDER BY dc.created_at DESC
  `;

  // Get server connections assigned to user or their groups
  const assignedTargets = [userId, ...groups];
  const assigned = await sql<{ connection_id: string }[]>`
    SELECT DISTINCT connection_id
    FROM server_connection_assignments
    WHERE assigned_to = ANY(${assignedTargets})
  `;

  const results = [
    ...owned.map(toClientConnection),
    ...shared.map(toClientConnection),
  ];

  // Server connection IDs are returned separately - they're resolved from config/databases.json
  // The caller will merge them from getServerConfig()
  return results;
}

export async function getAssignedServerConnectionIds(
  userId: string,
  groups: string[] = []
): Promise<string[]> {
  const sql = getAppDb()!;
  const assignedTargets = [userId, ...groups];
  const rows = await sql<{ connection_id: string }[]>`
    SELECT DISTINCT connection_id
    FROM server_connection_assignments
    WHERE assigned_to = ANY(${assignedTargets})
  `;
  return rows.map(r => r.connection_id);
}

export async function createConnection(
  userId: string,
  conn: DatabaseConnection
): Promise<DatabaseConnection> {
  const sql = getAppDb()!;
  const passwordEnc = conn.password ? encryptPassword(conn.password) : '';

  const [row] = await sql<DbConnection[]>`
    INSERT INTO database_connections (
      id, owner_id, name, type, host, port, database_name, username,
      password_enc, filepath, description, status, schema_file_id,
      vector_store_id, source, created_at
    ) VALUES (
      ${conn.id}, ${userId}, ${conn.name}, ${conn.type}, ${conn.host},
      ${conn.port}, ${conn.database}, ${conn.username}, ${passwordEnc},
      ${conn.filepath || null}, ${conn.description || null},
      ${conn.status || 'disconnected'}, ${conn.schemaFileId || null},
      ${conn.vectorStoreId || null}, ${'local'},
      ${conn.createdAt || new Date().toISOString()}
    )
    RETURNING *
  `;
  return toClientConnection(row);
}

export async function updateConnection(
  userId: string,
  conn: Partial<DatabaseConnection> & { id: string }
): Promise<DatabaseConnection | null> {
  const sql = getAppDb()!;

  // Verify ownership or admin share
  const [existing] = await sql<DbConnection[]>`
    SELECT dc.* FROM database_connections dc
    LEFT JOIN connection_shares cs ON cs.connection_id = dc.id AND cs.shared_with_id = ${userId}
    WHERE dc.id = ${conn.id}
      AND (dc.owner_id = ${userId} OR cs.permission IN ('edit', 'admin'))
  `;

  if (!existing) return null;

  // Build update values
  const updates: Record<string, unknown> = {};
  if (conn.name !== undefined) updates.name = conn.name;
  if (conn.type !== undefined) updates.type = conn.type;
  if (conn.host !== undefined) updates.host = conn.host;
  if (conn.port !== undefined) updates.port = conn.port;
  if (conn.database !== undefined) updates.database_name = conn.database;
  if (conn.username !== undefined) updates.username = conn.username;
  if (conn.password !== undefined && conn.password !== '') {
    updates.password_enc = encryptPassword(conn.password);
  }
  if (conn.filepath !== undefined) updates.filepath = conn.filepath || null;
  if (conn.description !== undefined) updates.description = conn.description || null;
  if (conn.status !== undefined) updates.status = conn.status;
  if (conn.schemaFileId !== undefined) updates.schema_file_id = conn.schemaFileId || null;
  if (conn.vectorStoreId !== undefined) updates.vector_store_id = conn.vectorStoreId || null;

  if (Object.keys(updates).length === 0) {
    return toClientConnection(existing);
  }

  const [row] = await sql<DbConnection[]>`
    UPDATE database_connections SET
      name = COALESCE(${updates.name ?? null}, name),
      type = COALESCE(${updates.type ?? null}, type),
      host = COALESCE(${updates.host ?? null}, host),
      port = COALESCE(${updates.port ?? null}, port),
      database_name = COALESCE(${updates.database_name ?? null}, database_name),
      username = COALESCE(${updates.username ?? null}, username),
      password_enc = COALESCE(${updates.password_enc ?? null}, password_enc),
      filepath = ${updates.filepath !== undefined ? (updates.filepath as string | null) : existing.filepath},
      description = ${updates.description !== undefined ? (updates.description as string | null) : existing.description},
      status = COALESCE(${updates.status ?? null}, status),
      schema_file_id = ${updates.schema_file_id !== undefined ? (updates.schema_file_id as string | null) : existing.schema_file_id},
      vector_store_id = ${updates.vector_store_id !== undefined ? (updates.vector_store_id as string | null) : existing.vector_store_id}
    WHERE id = ${conn.id}
    RETURNING *
  `;

  return toClientConnection(row);
}

export async function deleteConnection(userId: string, id: string): Promise<boolean> {
  const sql = getAppDb()!;
  const result = await sql`
    DELETE FROM database_connections
    WHERE id = ${id} AND owner_id = ${userId}
  `;
  return result.count > 0;
}

export async function getConnectionCredentials(
  userId: string,
  connectionId: string
): Promise<{ password: string; host: string; port: string; database: string; username: string; filepath?: string; type: string } | null> {
  const sql = getAppDb()!;

  // Check ownership or sharing
  const [row] = await sql<DbConnection[]>`
    SELECT dc.* FROM database_connections dc
    LEFT JOIN connection_shares cs ON cs.connection_id = dc.id AND cs.shared_with_id = ${userId}
    WHERE dc.id = ${connectionId}
      AND (dc.owner_id = ${userId} OR cs.shared_with_id = ${userId})
  `;

  if (!row) return null;

  return {
    password: row.password_enc ? decryptPassword(row.password_enc) : '',
    host: row.host,
    port: row.port,
    database: row.database_name,
    username: row.username,
    filepath: row.filepath || undefined,
    type: row.type,
  };
}

export async function getConnectionById(
  userId: string,
  connectionId: string
): Promise<DatabaseConnection | null> {
  const sql = getAppDb()!;

  const [row] = await sql<DbConnection[]>`
    SELECT dc.* FROM database_connections dc
    LEFT JOIN connection_shares cs ON cs.connection_id = dc.id AND cs.shared_with_id = ${userId}
    WHERE dc.id = ${connectionId}
      AND (dc.owner_id = ${userId} OR cs.shared_with_id = ${userId})
  `;

  if (!row) return null;
  return toClientConnection(row);
}
