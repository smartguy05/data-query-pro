/**
 * A captured failed->revised SQL pair, used to warn the AI generator away from
 * repeating known mistakes (especially wrong table/column names) for a schema.
 *
 * Device-local (localStorage) when auth is disabled. When auth is enabled it is
 * pooled team-wide in Postgres keyed by `schemaFingerprint` (see
 * lib/db/migrations/006_query_corrections.sql) so everyone querying a DB with the
 * same schema benefits. `ownerId`/`ownerName` are attribution-only (curation rights).
 */
export interface QueryCorrection {
  id: string;
  /** Fingerprint of the schema this correction applies to (see utils/schema-fingerprint). */
  schemaFingerprint: string;
  /** Natural-language question that produced the bad SQL, when available. */
  question?: string;
  /** The SQL that failed execution. */
  badSql: string;
  /** The sanitized execution error. */
  error: string;
  /** The corrected SQL produced by the revise endpoint. */
  goodSql: string;
  databaseType?: string;
  createdAt: string;
  /** Author user id (auth mode only). Used for curation rights (author or admin). */
  ownerId?: string;
  /** Author display name/email (auth mode only), resolved for the curation UI. */
  ownerName?: string;
  /** Last-modified timestamp (auth mode only). */
  updatedAt?: string;
}
