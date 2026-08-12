/**
 * Shared state for background schema-introspection jobs.
 *
 * The `declare global processStatus` block used to be duplicated verbatim in
 * app/api/schema/start-introspection/route.ts and app/api/schema/status/route.ts,
 * so adding a status meant editing two files in lockstep. This module owns it.
 *
 * Alongside each job's progress we keep an AbortController, which is what makes
 * introspection cancellable. Cancellation here is COOPERATIVE: introspection is
 * slow because it runs several queries per table, so BaseDatabaseAdapter checks
 * the signal between tables. That works on every engine, including SQLite, whose
 * individual queries can never be interrupted.
 *
 * Process-local, with the same single-instance caveat as
 * lib/database/query-registry.ts: a cancel that lands on another Next.js instance
 * cannot reach a job running on this one.
 */

export type IntrospectionJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface IntrospectionJob {
  status: IntrospectionJobStatus;
  progress: number;
  message: string;
  result?: unknown;
  error?: string;
  startTime: number;
}

export type CancelIntrospectionOutcome = 'cancelling' | 'not_found' | 'already_finished';

declare global {
  // eslint-disable-next-line no-var
  var processStatus: Map<string, IntrospectionJob> | undefined;
  // eslint-disable-next-line no-var
  var introspectionControllers: Map<string, AbortController> | undefined;
}

// Stored on globalThis so Next dev HMR cannot split the map in two.
function jobs(): Map<string, IntrospectionJob> {
  if (!global.processStatus) global.processStatus = new Map<string, IntrospectionJob>();
  return global.processStatus;
}

function controllers(): Map<string, AbortController> {
  if (!global.introspectionControllers) {
    global.introspectionControllers = new Map<string, AbortController>();
  }
  return global.introspectionControllers;
}

export function getJob(processId: string): IntrospectionJob | undefined {
  return jobs().get(processId);
}

export function setJob(processId: string, job: IntrospectionJob): void {
  jobs().set(processId, job);
}

/** Merges a partial update into an existing job; a no-op if it is already gone. */
export function patchJob(processId: string, patch: Partial<IntrospectionJob>): void {
  const existing = jobs().get(processId);
  if (!existing) return;
  jobs().set(processId, { ...existing, ...patch });
}

export function deleteJob(processId: string): void {
  jobs().delete(processId);
  controllers().delete(processId);
}

export function registerIntrospectionController(
  processId: string,
  controller: AbortController
): void {
  controllers().set(processId, controller);
}

/** Drops the controller once the job has finished, so it cannot be aborted late. */
export function clearIntrospectionController(processId: string): void {
  controllers().delete(processId);
}

/**
 * Requests cancellation of a running introspection. Terminal jobs report
 * 'already_finished' rather than an error — that race is normal.
 */
export function cancelIntrospection(processId: string): CancelIntrospectionOutcome {
  const job = jobs().get(processId);
  if (!job) return 'not_found';
  if (job.status === 'completed' || job.status === 'error' || job.status === 'cancelled') {
    return 'already_finished';
  }
  const controller = controllers().get(processId);
  if (!controller) return 'already_finished';

  controller.abort();
  patchJob(processId, {
    status: 'cancelled',
    progress: 0,
    message: 'Schema introspection cancelled.',
  });
  return 'cancelling';
}
