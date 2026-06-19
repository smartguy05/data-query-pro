import { getAppDb } from '../pool';
import type { SavedReport, ReportParameter } from '@/models/saved-report.interface';

interface DbReport {
  id: string;
  connection_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  natural_language_query: string;
  sql: string;
  explanation: string;
  warnings: string[] | string;
  confidence: number;
  parameters: ReportParameter[] | string;
  is_favorite: boolean;
  created_at: Date;
  last_modified: Date;
  last_run: Date | null;
  // Join fields for shared reports
  permission?: string;
  shared_by_email?: string | null;
  shared_by_name?: string | null;
}

function parseJsonb<T>(data: T | string, fallback: T): T {
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return fallback; }
  }
  return data ?? fallback;
}

function toClientReport(
  row: DbReport,
  accessLevel: SavedReport['accessLevel'] = 'owner'
): SavedReport {
  return {
    id: row.id,
    connectionId: row.connection_id,
    name: row.name,
    description: row.description || undefined,
    naturalLanguageQuery: row.natural_language_query,
    sql: row.sql,
    explanation: row.explanation,
    warnings: parseJsonb(row.warnings, []),
    confidence: row.confidence,
    parameters: parseJsonb(row.parameters, []),
    isFavorite: row.is_favorite,
    createdAt: row.created_at.toISOString(),
    lastModified: row.last_modified.toISOString(),
    lastRun: row.last_run?.toISOString(),
    accessLevel,
    sharedByEmail: row.shared_by_email || undefined,
    sharedByName: row.shared_by_name ?? undefined,
  };
}

export async function getReportsForUser(userId: string): Promise<SavedReport[]> {
  const sql = getAppDb()!;

  // Get owned reports
  const owned = await sql<DbReport[]>`
    SELECT * FROM saved_reports WHERE owner_id = ${userId}
    ORDER BY last_modified DESC
  `;

  // Get shared reports (with the owner's identity for "Shared by …" display)
  const shared = await sql<DbReport[]>`
    SELECT sr.*, rs.permission,
           u.email AS shared_by_email, u.name AS shared_by_name
    FROM saved_reports sr
    JOIN report_shares rs ON rs.report_id = sr.id
    LEFT JOIN users u ON u.id = sr.owner_id
    WHERE rs.shared_with_id = ${userId}
    ORDER BY sr.last_modified DESC
  `;

  return [
    ...owned.map((row) => toClientReport(row, 'owner')),
    ...shared.map((row) =>
      toClientReport(row, (row.permission as SavedReport['accessLevel']) || 'view')
    ),
  ];
}

export async function createReport(
  userId: string,
  report: SavedReport
): Promise<SavedReport> {
  const sql = getAppDb()!;

  const [row] = await sql<DbReport[]>`
    INSERT INTO saved_reports (
      id, connection_id, owner_id, name, description,
      natural_language_query, sql, explanation, warnings,
      confidence, parameters, is_favorite, created_at,
      last_modified, last_run
    ) VALUES (
      ${report.id}, ${report.connectionId}, ${userId}, ${report.name},
      ${report.description || null}, ${report.naturalLanguageQuery},
      ${report.sql}, ${report.explanation}, ${sql.json(report.warnings || [])},
      ${report.confidence}, ${sql.json((report.parameters || []) as unknown as Parameters<typeof sql.json>[0])},
      ${report.isFavorite || false}, ${report.createdAt},
      ${report.lastModified}, ${report.lastRun || null}
    )
    RETURNING *
  `;

  return toClientReport(row);
}

export async function updateReport(
  userId: string,
  report: Partial<SavedReport> & { id: string }
): Promise<SavedReport | null> {
  const sql = getAppDb()!;

  // Check ownership or edit share
  const [existing] = await sql<DbReport[]>`
    SELECT sr.* FROM saved_reports sr
    LEFT JOIN report_shares rs ON rs.report_id = sr.id AND rs.shared_with_id = ${userId}
    WHERE sr.id = ${report.id}
      AND (sr.owner_id = ${userId} OR rs.permission = 'edit')
  `;

  if (!existing) return null;

  const [row] = await sql<DbReport[]>`
    UPDATE saved_reports SET
      name = COALESCE(${report.name ?? null}, name),
      description = ${report.description !== undefined ? (report.description || null) : existing.description},
      natural_language_query = COALESCE(${report.naturalLanguageQuery ?? null}, natural_language_query),
      sql = COALESCE(${report.sql ?? null}, sql),
      explanation = COALESCE(${report.explanation ?? null}, explanation),
      warnings = COALESCE(${report.warnings ? sql.json(report.warnings) : null}, warnings),
      confidence = COALESCE(${report.confidence ?? null}, confidence),
      parameters = COALESCE(${report.parameters ? sql.json(report.parameters as unknown as Parameters<typeof sql.json>[0]) : null}, parameters),
      is_favorite = COALESCE(${report.isFavorite ?? null}, is_favorite),
      last_modified = ${report.lastModified || new Date().toISOString()},
      last_run = ${report.lastRun || existing.last_run}
    WHERE id = ${report.id}
    RETURNING *
  `;

  return toClientReport(row);
}

export async function deleteReport(userId: string, id: string): Promise<boolean> {
  const sql = getAppDb()!;
  const result = await sql`
    DELETE FROM saved_reports WHERE id = ${id} AND owner_id = ${userId}
  `;
  return result.count > 0;
}

export async function getReportById(
  userId: string,
  id: string
): Promise<SavedReport | null> {
  const sql = getAppDb()!;

  const [row] = await sql<DbReport[]>`
    SELECT sr.* FROM saved_reports sr
    LEFT JOIN report_shares rs ON rs.report_id = sr.id AND rs.shared_with_id = ${userId}
    WHERE sr.id = ${id}
      AND (sr.owner_id = ${userId} OR rs.shared_with_id = ${userId})
  `;

  if (!row) return null;
  return toClientReport(row);
}
