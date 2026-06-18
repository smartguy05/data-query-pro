import { getAppDb } from '../pool';
import type { QueryCorrection } from '@/models/query-correction.interface';

interface DbQueryCorrection {
  id: string;
  schema_fingerprint: string;
  owner_id: string | null;
  question: string | null;
  bad_sql: string;
  error: string;
  good_sql: string;
  database_type: string | null;
  created_at: Date;
  updated_at: Date;
  // From the LEFT JOIN to users (present only on getByFingerprint):
  owner_name?: string | null;
  owner_email?: string | null;
}

function toClient(row: DbQueryCorrection): QueryCorrection {
  return {
    id: row.id,
    schemaFingerprint: row.schema_fingerprint,
    question: row.question ?? undefined,
    badSql: row.bad_sql,
    error: row.error,
    goodSql: row.good_sql,
    databaseType: row.database_type ?? undefined,
    createdAt: row.created_at.toISOString(),
    ownerId: row.owner_id ?? undefined,
    ownerName: row.owner_name || row.owner_email || undefined,
    updatedAt: row.updated_at?.toISOString(),
  };
}

/**
 * Corrections for a schema fingerprint — pooled team-wide (NOT scoped by user),
 * newest first. `limit` bounds the work as the shared pool grows.
 */
export async function getByFingerprint(
  fingerprint: string,
  limit: number
): Promise<QueryCorrection[]> {
  if (!fingerprint) return [];
  const sql = getAppDb()!;

  const rows = await sql<DbQueryCorrection[]>`
    SELECT qc.*, u.name AS owner_name, u.email AS owner_email
    FROM query_corrections qc
    LEFT JOIN users u ON u.id = qc.owner_id
    WHERE qc.schema_fingerprint = ${fingerprint}
    ORDER BY qc.created_at DESC
    LIMIT ${limit}
  `;

  return rows.map(toClient);
}

/**
 * Record a correction into the shared pool. `owner_id` is stamped from the
 * authenticated user (any client-supplied owner is ignored). Identical entries
 * (same fingerprint + bad/good SQL) are de-duped via the unique index.
 */
export async function createCorrection(
  userId: string,
  c: QueryCorrection
): Promise<void> {
  const sql = getAppDb()!;

  await sql`
    INSERT INTO query_corrections (
      id, schema_fingerprint, owner_id, question, bad_sql, error, good_sql, database_type, created_at
    ) VALUES (
      ${c.id}, ${c.schemaFingerprint}, ${userId}, ${c.question ?? null},
      ${c.badSql}, ${c.error}, ${c.goodSql}, ${c.databaseType ?? null},
      ${c.createdAt || new Date().toISOString()}
    )
    ON CONFLICT DO NOTHING
  `;
}

/**
 * Edit a correction. Allowed only for the author or an admin. Returns the updated
 * row, or null when the entry does not exist or the user lacks permission.
 */
export async function updateCorrection(
  userId: string,
  isAdmin: boolean,
  id: string,
  patch: Partial<Pick<QueryCorrection, 'question' | 'error' | 'goodSql'>>
): Promise<QueryCorrection | null> {
  const sql = getAppDb()!;

  const [row] = await sql<DbQueryCorrection[]>`
    UPDATE query_corrections SET
      question = COALESCE(${patch.question ?? null}, question),
      error    = COALESCE(${patch.error ?? null}, error),
      good_sql = COALESCE(${patch.goodSql ?? null}, good_sql),
      updated_at = NOW()
    WHERE id = ${id} AND (owner_id = ${userId} OR ${isAdmin})
    RETURNING *
  `;

  return row ? toClient(row) : null;
}

/**
 * Delete a correction. Allowed only for the author or an admin. Returns true when
 * a row was removed.
 */
export async function deleteCorrection(
  userId: string,
  isAdmin: boolean,
  id: string
): Promise<boolean> {
  const sql = getAppDb()!;

  const result = await sql`
    DELETE FROM query_corrections
    WHERE id = ${id} AND (owner_id = ${userId} OR ${isAdmin})
  `;

  return result.count > 0;
}
