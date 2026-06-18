import type { Schema } from "@/models/schema.interface";

/**
 * 32-bit FNV-1a hash → 8-char hex. Pure JS (no deps) so it runs client-side.
 */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Computes a stable, order-independent fingerprint of a schema's shape from its
 * lowercased table + column names. Two connections pointing at the same database
 * (e.g. dev/staging/prod) produce the same fingerprint, so learned examples and
 * corrections can be shared across them.
 *
 * Names are lowercased so casing drift between environments doesn't fragment the
 * bucket — the generation prompt still enforces exact casing from the live schema.
 * Types/nullability/FKs are intentionally excluded; a renamed column changes the
 * fingerprint (correct — old-name examples should not carry over).
 */
export function computeSchemaFingerprint(schema: Schema | null | undefined): string {
  if (!schema?.tables?.length) return "";
  const parts = schema.tables
    .map((t) => {
      const cols = (t.columns ?? []).map((c) => c.name.toLowerCase()).sort();
      return `${t.name.toLowerCase()}(${cols.join(",")})`;
    })
    .sort();
  return fnv1a(parts.join("|"));
}
