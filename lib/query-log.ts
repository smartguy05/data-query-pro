import { isAppDbEnabled } from "./db/pool";
import { insertLog, type QueryLogEntry } from "./db/repositories/query-log-repository";
import { appendLogToFile } from "./query-log-file";

export type { QueryLogEntry } from "./db/repositories/query-log-repository";

/**
 * Sentinel recorded in QueryLogEntry.error when a user cancels a query.
 *
 * A cancelled execution is logged with success:false rather than as a third
 * state: `query_log.success` is NOT NULL (migration 005) and the table is
 * documented as write-once, so a tri-state would mean a migration plus matching
 * changes in the JSONL fallback. success:false is truthful (the query produced no
 * result) and logging it at all is correct (it did consume database resources).
 *
 * Being a fixed string, it stays exactly queryable — `WHERE error = '...'` — and
 * behaves identically in the app-DB and JSONL paths. A dedicated `cancelled`
 * column can be added later without touching the call site.
 */
export const CANCELLED_LOG_MESSAGE = "Query cancelled by user";

/**
 * Single entry point for the query audit log. Logs to the app database when
 * configured, otherwise to a JSONL file. Fire-and-forget: never throws into the
 * caller's execution path (mirrors recordQueryHistory / accuracy persistence).
 *
 * Credentials must never be passed in — QueryLogEntry has no field for them.
 */
export function logQuery(entry: QueryLogEntry): void {
  const write = isAppDbEnabled() ? insertLog(entry) : appendLogToFile(entry);
  Promise.resolve(write).catch((err) =>
    console.warn("[query-log] failed to persist audit entry:", err)
  );
}
