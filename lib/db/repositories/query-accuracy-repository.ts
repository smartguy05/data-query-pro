import { getAppDb } from '../pool';
import type { QueryAccuracyStats } from '@/models/query-accuracy.interface';

interface DbQueryAccuracy {
  owner_id: string;
  total: number;
  successful: number;
  created_at: Date;
  updated_at: Date;
}

export async function getStats(userId: string): Promise<QueryAccuracyStats> {
  const sql = getAppDb()!;

  const [row] = await sql<DbQueryAccuracy[]>`
    SELECT * FROM query_accuracy_stats WHERE owner_id = ${userId}
  `;

  if (!row) {
    return { total: 0, successful: 0 };
  }

  return { total: Number(row.total), successful: Number(row.successful) };
}

/**
 * Atomically apply deltas to the user's counters. Clamped so `total`/`successful`
 * never go negative and `successful` never exceeds `total`.
 */
export async function applyDelta(
  userId: string,
  totalDelta: number,
  successfulDelta: number
): Promise<void> {
  const sql = getAppDb()!;

  await sql`
    INSERT INTO query_accuracy_stats (owner_id, total, successful)
    VALUES (
      ${userId},
      GREATEST(${totalDelta}, 0),
      GREATEST(LEAST(${successfulDelta}, ${totalDelta}), 0)
    )
    ON CONFLICT (owner_id) DO UPDATE SET
      total = GREATEST(query_accuracy_stats.total + ${totalDelta}, 0),
      successful = LEAST(
        GREATEST(query_accuracy_stats.successful + ${successfulDelta}, 0),
        GREATEST(query_accuracy_stats.total + ${totalDelta}, 0)
      ),
      updated_at = NOW()
  `;
}
