/**
 * Query accuracy stats: a running tally of AI-generated query executions used to
 * compute a "% Query Accuracy" dashboard stat.
 *
 * Per-user, device-local by default (localStorage `query_accuracy`) and synced to
 * Postgres when auth is enabled (table `query_accuracy_stats`). Global across all
 * connections — counters only, no per-query records.
 *
 * accuracy% = Math.round(successful / total * 100)
 */
export interface QueryAccuracyStats {
  /** Total AI-generated/follow-up query executions counted (every attempt counts). */
  total: number;
  /** Of those, how many are considered successful (no error, minus user overrides). */
  successful: number;
}
