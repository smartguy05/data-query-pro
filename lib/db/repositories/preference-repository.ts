import { getAppDb } from '../pool';

interface DbPreference {
  user_id: string;
  current_connection_id: string | null;
  preferences: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export async function getPreferences(userId: string): Promise<{
  currentConnectionId: string | null;
  preferences: Record<string, unknown>;
}> {
  const sql = getAppDb()!;

  const [row] = await sql<DbPreference[]>`
    SELECT * FROM user_preferences WHERE user_id = ${userId}
  `;

  if (!row) {
    return { currentConnectionId: null, preferences: {} };
  }

  return {
    currentConnectionId: row.current_connection_id,
    preferences: row.preferences || {},
  };
}

export async function updatePreferences(
  userId: string,
  data: {
    currentConnectionId?: string | null;
    preferences?: Record<string, unknown>;
  }
): Promise<void> {
  const sql = getAppDb()!;

  await sql`
    INSERT INTO user_preferences (user_id, current_connection_id, preferences)
    VALUES (
      ${userId},
      ${data.currentConnectionId ?? null},
      ${JSON.stringify(data.preferences || {})}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      current_connection_id = COALESCE(${data.currentConnectionId !== undefined ? data.currentConnectionId : null}, user_preferences.current_connection_id),
      preferences = COALESCE(${data.preferences ? JSON.stringify(data.preferences) : null}, user_preferences.preferences)
  `;
}
