import { getAppDb } from '../pool';

/**
 * A single audit-log entry for an executed query. Credentials are NEVER part of
 * this shape — only the SQL text, the NL question, connection identity, and
 * execution outcome. Shared by the DB repository and the file-fallback logger.
 */
export interface QueryLogEntry {
  userId?: string | null;
  connectionId: string;
  connectionName?: string;
  databaseType?: string;
  question?: string;
  sql: string;
  source?: string;
  success: boolean;
  rowCount?: number;
  durationMs?: number;
  error?: string;
}

/** Append one immutable audit row to the app database. */
export async function insertLog(entry: QueryLogEntry): Promise<void> {
  const sql = getAppDb()!;

  await sql`
    INSERT INTO query_log
      (user_id, connection_id, connection_name, database_type, question,
       sql, source, success, row_count, duration_ms, error)
    VALUES (
      ${entry.userId ?? null}, ${entry.connectionId}, ${entry.connectionName ?? null},
      ${entry.databaseType ?? null}, ${entry.question ?? null}, ${entry.sql},
      ${entry.source ?? null}, ${entry.success}, ${entry.rowCount ?? null},
      ${entry.durationMs ?? null}, ${entry.error ?? null}
    )
  `;
}
