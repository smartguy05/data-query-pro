/**
 * A single executed-query history entry.
 *
 * Captured at the query-execution choke point for every query that executes
 * successfully (failed executions are not recorded). History is device-local
 * convenience data — it is persisted in localStorage even in auth mode and never
 * synced to the app database.
 *
 * `success`/`error` are retained for backward compatibility with legacy entries;
 * new entries are always `success: true`.
 */
export interface QueryHistoryEntry {
  id: string;
  connectionId: string;
  connectionName?: string;   // denormalized so entries still read well if the connection is later deleted
  databaseType?: string;

  question?: string;         // natural-language question, when the query came from generation/follow-up
  sql: string;

  source: 'generated' | 'manual' | 'report' | 'followup';

  success: boolean;
  rowCount?: number;
  executionTimeMs?: number;
  error?: string;            // message shown on failure

  executedAt: string;        // ISO timestamp
}
