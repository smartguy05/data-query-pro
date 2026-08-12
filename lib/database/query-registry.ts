/**
 * In-flight query registry: the bridge that lets one HTTP request cancel a query
 * started by another.
 *
 * A client-side AbortController cannot reach across requests, and adapters are
 * constructed fresh per request by DatabaseAdapterFactory, so nothing otherwise
 * retains a handle to a running query. This module maps a query id to an
 * AbortController; POST /api/query/cancel aborts it, and the adapter running the
 * query performs the driver-specific kill in its own abort listener.
 *
 * Deliberately dependency-free — it imports no adapter and no database driver.
 * That is what makes it the one part of cancellation that can be unit-tested,
 * and it means the registry never needs to know *how* a given engine cancels.
 *
 * LIMITATION — process-local. A cancel routed to a different Next.js instance
 * cannot reach a query running on this one (it returns 'not_found', and the query
 * runs on unattended), and on serverless each request may be a separate sandbox.
 * This matches the app's existing single-instance assumption; see the
 * `global.processStatus` map used by /api/schema/start-introspection. If
 * multi-instance support is ever needed, persist { queryId -> pid, engine,
 * connectionId } in the app DB: because every kill is plain out-of-band SQL
 * (pg_cancel_backend / KILL QUERY), any instance could then execute it, with no
 * need for sticky sessions. The QUERY_TIMEOUT statement timeouts are the backstop
 * until then.
 */
import type { DatabaseType } from './types';

export interface QueryRegistryEntry {
  /** Aborting this triggers the adapter's driver-specific kill. */
  controller: AbortController;
  /** Who started the query; see registryKey() for why this is also in the key. */
  ownerKey: string;
  engine: DatabaseType;
  /** From adapter.supportsCancellation — false for SQLite. */
  cancellable: boolean;
  startedAt: number;
  cancelledAt?: number;
}

export type CancelOutcome =
  | 'cancelling'
  | 'already_cancelled'
  | 'not_cancellable'
  | 'not_found'
  | 'forbidden';

export const QUERY_REGISTRY_LIMITS = {
  /**
   * Leak backstop for entries whose `finally` never ran (process paused mid-flight,
   * unhandled crash path). Set far above QUERY_TIMEOUT.STATEMENT_MS (120s) so a
   * swept entry is one whose query the database has already killed itself —
   * sweeping never realistically discards a live, cancellable query.
   */
  TTL_MS: 10 * 60 * 1000,
  /** Hard ceiling on concurrent tracked queries. */
  MAX_ENTRIES: 200,
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Narrows an untrusted client-supplied query id.
 *
 * Ids are generated client-side because the client needs one *before* the execute
 * response arrives — that is the whole point of cancelling an in-flight request.
 * Being client input, the value is bounded and hex-only so it can never inject
 * into a log line or be used as a path segment.
 *
 * Returns undefined when absent OR malformed; callers distinguish the two, since
 * an absent id means "run without registration" (which keeps older clients and
 * the eval harness working) while a malformed one is a 400.
 */
export function parseQueryId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  return UUID_RE.test(raw) ? raw : undefined;
}

/**
 * Namespaces the map key by owner so one user's query id can never collide with
 * — or address — another's. This makes cross-owner cancellation structurally
 * impossible rather than merely checked.
 */
export function registryKey(ownerKey: string, queryId: string): string {
  return `${ownerKey}:${queryId}`;
}

// Stored on globalThis, not in a module-level const, following the precedent of
// `global.processStatus` in /api/schema/start-introspection: Next dev HMR
// re-evaluates route modules, so a module-scoped Map would silently split into
// two and cancels would stop finding entries in dev only.
declare global {
  // eslint-disable-next-line no-var
  var __queryRegistry: Map<string, QueryRegistryEntry> | undefined;
}

function registry(): Map<string, QueryRegistryEntry> {
  if (!global.__queryRegistry) {
    global.__queryRegistry = new Map<string, QueryRegistryEntry>();
  }
  return global.__queryRegistry;
}

/**
 * Drops entries past their TTL. Called on every registration so cleanup is
 * amortized — no setInterval, which would leak a timer per HMR reload.
 * Returns how many were removed.
 */
export function sweepQueries(now: number = Date.now()): number {
  const map = registry();
  let removed = 0;
  for (const [key, entry] of map) {
    if (now - entry.startedAt >= QUERY_REGISTRY_LIMITS.TTL_MS) {
      map.delete(key);
      removed++;
    }
  }
  return removed;
}

/**
 * Tracks a query so it can be cancelled. Returns false when it could not be
 * registered, in which case the caller should still run the query — just
 * uncancellably.
 *
 * Refuses rather than overwrites on a duplicate key: overwriting would orphan the
 * first entry, leaving a running query with no handle to kill it. Likewise
 * refuses when full instead of evicting, because the controller is the *only*
 * handle to a running query — evicting a live entry would convert a cancellable
 * query into an unkillable one.
 */
export function registerQuery(
  key: string,
  entry: QueryRegistryEntry,
  now: number = Date.now()
): boolean {
  const map = registry();
  sweepQueries(now);
  if (map.has(key)) return false;
  if (map.size >= QUERY_REGISTRY_LIMITS.MAX_ENTRIES) return false;
  map.set(key, entry);
  return true;
}

/** Stops tracking a query. Must run in the same `finally` as adapter.disconnect(). */
export function unregisterQuery(key: string): void {
  registry().delete(key);
}

/**
 * Requests cancellation of a tracked query.
 *
 * Note the outcome is 'cancelling', not 'cancelled': aborting only *requests* the
 * kill, and the authoritative result is how the execute request itself resolves
 * (pg_cancel_backend can return false, a KILL can be refused).
 *
 * A cancel for another owner's id yields 'not_found' rather than 'forbidden',
 * because the namespaced key simply will not match — which is also the better
 * disclosure, since it does not confirm that someone else's query exists. The
 * explicit ownerKey comparison below is therefore normally unreachable; it is
 * defence in depth against a future key-construction bug.
 */
export function cancelQuery(
  queryId: string,
  ownerKey: string,
  now: number = Date.now()
): CancelOutcome {
  const entry = registry().get(registryKey(ownerKey, queryId));
  if (!entry) return 'not_found';
  if (entry.ownerKey !== ownerKey) return 'forbidden';
  // Report honestly instead of aborting: on SQLite the abort could not stop the
  // query anyway, and pretending otherwise is worse than saying so.
  if (!entry.cancellable) return 'not_cancellable';
  if (entry.cancelledAt !== undefined) return 'already_cancelled';

  entry.cancelledAt = now;
  entry.controller.abort();
  return 'cancelling';
}

/** Number of tracked queries. Exposed for diagnostics and tests. */
export function registrySize(): number {
  return registry().size;
}

/** Test-only: drops all tracked queries. */
export function clearQueryRegistry(): void {
  registry().clear();
}
