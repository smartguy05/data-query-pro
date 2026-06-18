import { STORAGE_KEYS, CORRECTIONS } from "@/lib/constants";
import type { QueryCorrection } from "@/models/query-correction.interface";

/**
 * Device-local store for failed->revised query corrections (localStorage), in
 * both auth and no-auth modes — mirroring how query history is kept device-local.
 * Capped ring buffer, newest first. All access is SSR-safe and never throws.
 */

export function getQueryCorrections(): QueryCorrection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUERY_CORRECTIONS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addQueryCorrection(entry: QueryCorrection): void {
  if (typeof window === "undefined") return;
  try {
    const next = [entry, ...getQueryCorrections()].slice(0, CORRECTIONS.MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEYS.QUERY_CORRECTIONS, JSON.stringify(next));
  } catch {
    /* ignore quota / serialization errors — corrections are best-effort */
  }
}

/** Corrections recorded for the given schema fingerprint (empty fingerprint → none). */
export function getCorrectionsForFingerprint(fingerprint: string): QueryCorrection[] {
  if (!fingerprint) return [];
  return getQueryCorrections().filter((c) => c.schemaFingerprint === fingerprint);
}

/** Edit a stored correction in place by id (curation). Best-effort; never throws. */
export function updateQueryCorrection(id: string, patch: Partial<QueryCorrection>): void {
  if (typeof window === "undefined") return;
  try {
    const next = getQueryCorrections().map((c) =>
      c.id === id ? { ...c, ...patch, id: c.id } : c
    );
    localStorage.setItem(STORAGE_KEYS.QUERY_CORRECTIONS, JSON.stringify(next));
  } catch {
    /* best-effort */
  }
}

/** Remove a stored correction by id (curation). Best-effort; never throws. */
export function deleteQueryCorrection(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = getQueryCorrections().filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.QUERY_CORRECTIONS, JSON.stringify(next));
  } catch {
    /* best-effort */
  }
}
