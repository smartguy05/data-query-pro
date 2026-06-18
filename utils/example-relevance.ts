/**
 * Lightweight relevance scoring for picking which past queries to feed the AI
 * as few-shot examples. Token/Jaccard overlap on the natural-language question,
 * with a small boost when the candidate's SQL mentions tokens from the new
 * question (signals the same subject/tables). No embeddings.
 */

export interface ScoredCandidate<T> {
  item: T;
  score: number;
}

/** Split text into lowercase word tokens (identifiers, numbers). */
export function tokenize(s: string | undefined | null): Set<string> {
  return new Set((s ?? "").toLowerCase().match(/[a-z0-9_]+/g) ?? []);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Score each candidate against the new question. Base = Jaccard over question
 * tokens; bonus (up to +0.25) for candidate SQL referencing question tokens.
 */
export function scoreByQuestion<T extends { question?: string; sql: string }>(
  newQuestion: string,
  candidates: T[]
): ScoredCandidate<T>[] {
  const qTokens = tokenize(newQuestion);
  return candidates.map((item) => {
    const base = jaccard(qTokens, tokenize(item.question));
    const sqlTokens = tokenize(item.sql);
    let overlap = 0;
    for (const t of qTokens) if (sqlTokens.has(t)) overlap++;
    const boost = qTokens.size ? (overlap / qTokens.size) * 0.25 : 0;
    return { item, score: base + boost };
  });
}

/** Sort by score desc, drop anything below minScore, take the top n. */
export function topN<T>(scored: ScoredCandidate<T>[], n: number, minScore = 0.05): T[] {
  return scored
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((s) => s.item);
}
