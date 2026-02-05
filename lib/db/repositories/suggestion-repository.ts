import { getAppDb } from '../pool';

interface DbSuggestion {
  id: string;
  connection_id: string;
  owner_id: string;
  suggestions: unknown[];
  created_at: Date;
  updated_at: Date;
}

export async function getSuggestions(
  connectionId: string,
  userId: string
): Promise<unknown[] | null> {
  const sql = getAppDb()!;

  const [row] = await sql<DbSuggestion[]>`
    SELECT * FROM suggestions_cache
    WHERE connection_id = ${connectionId} AND owner_id = ${userId}
  `;

  return row ? row.suggestions : null;
}

export async function upsertSuggestions(
  connectionId: string,
  userId: string,
  suggestions: unknown[]
): Promise<void> {
  const sql = getAppDb()!;

  await sql`
    INSERT INTO suggestions_cache (connection_id, owner_id, suggestions)
    VALUES (${connectionId}, ${userId}, ${JSON.stringify(suggestions)})
    ON CONFLICT (connection_id, owner_id) DO UPDATE SET
      suggestions = EXCLUDED.suggestions
  `;
}
