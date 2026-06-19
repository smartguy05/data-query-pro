import { isAppDbEnabled } from "./db/pool";
import { insertLog, type QueryLogEntry } from "./db/repositories/query-log-repository";
import { appendLogToFile } from "./query-log-file";

export type { QueryLogEntry } from "./db/repositories/query-log-repository";

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
