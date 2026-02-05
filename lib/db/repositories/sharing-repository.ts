import { getAppDb } from '../pool';

interface DbShare {
  id: string;
  connection_id?: string;
  report_id?: string;
  shared_with_id: string;
  permission: string;
  created_at: Date;
  // Joined user info
  email?: string;
  name?: string;
}

export interface ShareInfo {
  id: string;
  sharedWithId: string;
  email: string;
  name: string | null;
  permission: string;
  createdAt: string;
}

// ---- Connection Sharing ----

export async function getSharesForConnection(connectionId: string): Promise<ShareInfo[]> {
  const sql = getAppDb()!;

  const rows = await sql<DbShare[]>`
    SELECT cs.*, u.email, u.name
    FROM connection_shares cs
    JOIN users u ON u.id = cs.shared_with_id
    WHERE cs.connection_id = ${connectionId}
    ORDER BY u.name, u.email
  `;

  return rows.map(r => ({
    id: r.id,
    sharedWithId: r.shared_with_id,
    email: r.email || '',
    name: r.name || null,
    permission: r.permission,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function shareConnection(
  connectionId: string,
  ownerId: string,
  sharedWithId: string,
  permission: 'view' | 'edit' | 'admin'
): Promise<boolean> {
  const sql = getAppDb()!;

  // Verify ownership
  const [conn] = await sql`
    SELECT id FROM database_connections WHERE id = ${connectionId} AND owner_id = ${ownerId}
  `;
  if (!conn) return false;

  await sql`
    INSERT INTO connection_shares (connection_id, shared_with_id, permission)
    VALUES (${connectionId}, ${sharedWithId}, ${permission})
    ON CONFLICT (connection_id, shared_with_id) DO UPDATE SET
      permission = EXCLUDED.permission
  `;
  return true;
}

export async function removeConnectionShare(
  connectionId: string,
  ownerId: string,
  sharedWithId: string
): Promise<boolean> {
  const sql = getAppDb()!;

  // Verify ownership
  const [conn] = await sql`
    SELECT id FROM database_connections WHERE id = ${connectionId} AND owner_id = ${ownerId}
  `;
  if (!conn) return false;

  const result = await sql`
    DELETE FROM connection_shares
    WHERE connection_id = ${connectionId} AND shared_with_id = ${sharedWithId}
  `;
  return result.count > 0;
}

// ---- Report Sharing ----

export async function getSharesForReport(reportId: string): Promise<ShareInfo[]> {
  const sql = getAppDb()!;

  const rows = await sql<DbShare[]>`
    SELECT rs.*, u.email, u.name
    FROM report_shares rs
    JOIN users u ON u.id = rs.shared_with_id
    WHERE rs.report_id = ${reportId}
    ORDER BY u.name, u.email
  `;

  return rows.map(r => ({
    id: r.id,
    sharedWithId: r.shared_with_id,
    email: r.email || '',
    name: r.name || null,
    permission: r.permission,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function shareReport(
  reportId: string,
  ownerId: string,
  sharedWithId: string,
  permission: 'view' | 'edit'
): Promise<boolean> {
  const sql = getAppDb()!;

  // Verify ownership
  const [report] = await sql`
    SELECT id FROM saved_reports WHERE id = ${reportId} AND owner_id = ${ownerId}
  `;
  if (!report) return false;

  await sql`
    INSERT INTO report_shares (report_id, shared_with_id, permission)
    VALUES (${reportId}, ${sharedWithId}, ${permission})
    ON CONFLICT (report_id, shared_with_id) DO UPDATE SET
      permission = EXCLUDED.permission
  `;
  return true;
}

export async function removeReportShare(
  reportId: string,
  ownerId: string,
  sharedWithId: string
): Promise<boolean> {
  const sql = getAppDb()!;

  // Verify ownership
  const [report] = await sql`
    SELECT id FROM saved_reports WHERE id = ${reportId} AND owner_id = ${ownerId}
  `;
  if (!report) return false;

  const result = await sql`
    DELETE FROM report_shares
    WHERE report_id = ${reportId} AND shared_with_id = ${sharedWithId}
  `;
  return result.count > 0;
}

// ---- Server Connection Assignments ----

export async function assignServerConnection(
  connectionId: string,
  assignedTo: string,
  assignedType: 'user' | 'group'
): Promise<void> {
  const sql = getAppDb()!;

  await sql`
    INSERT INTO server_connection_assignments (connection_id, assigned_to, assigned_type)
    VALUES (${connectionId}, ${assignedTo}, ${assignedType})
    ON CONFLICT (connection_id, assigned_to, assigned_type) DO NOTHING
  `;
}

export async function removeServerConnectionAssignment(
  connectionId: string,
  assignedTo: string,
  assignedType: 'user' | 'group'
): Promise<boolean> {
  const sql = getAppDb()!;

  const result = await sql`
    DELETE FROM server_connection_assignments
    WHERE connection_id = ${connectionId}
      AND assigned_to = ${assignedTo}
      AND assigned_type = ${assignedType}
  `;
  return result.count > 0;
}

export async function getAssignmentsForConnection(connectionId: string): Promise<{
  id: string;
  assignedTo: string;
  assignedType: 'user' | 'group';
  email?: string;
  name?: string;
}[]> {
  const sql = getAppDb()!;

  const rows = await sql<{
    id: string;
    assigned_to: string;
    assigned_type: string;
    email: string | null;
    name: string | null;
  }[]>`
    SELECT sca.*, u.email, u.name
    FROM server_connection_assignments sca
    LEFT JOIN users u ON u.id = sca.assigned_to AND sca.assigned_type = 'user'
    WHERE sca.connection_id = ${connectionId}
    ORDER BY sca.assigned_type, sca.assigned_to
  `;

  return rows.map(r => ({
    id: r.id,
    assignedTo: r.assigned_to,
    assignedType: r.assigned_type as 'user' | 'group',
    email: r.email || undefined,
    name: r.name || undefined,
  }));
}
