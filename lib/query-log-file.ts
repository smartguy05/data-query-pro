import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { QueryLogEntry } from "./db/repositories/query-log-repository";

/**
 * File fallback for the query audit log, used when the app database is not
 * configured (no-auth / local mode). Appends one JSON object per line (JSONL)
 * to `<cwd>/logs/query-log.jsonl`. Dependency-free (node:fs).
 *
 * Rotation is intentionally out of scope — pair with an external tool such as
 * logrotate if the file grows large.
 */
export async function appendLogToFile(entry: QueryLogEntry): Promise<void> {
  const dir = join(process.cwd(), "logs");
  await mkdir(dir, { recursive: true }); // idempotent
  const line =
    JSON.stringify({ ...entry, executedAt: new Date().toISOString() }) + "\n";
  await appendFile(join(dir, "query-log.jsonl"), line, "utf-8");
}
