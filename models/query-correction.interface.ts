/**
 * A captured failed->revised SQL pair, used to warn the AI generator away from
 * repeating known mistakes (especially wrong table/column names) for a schema.
 * Device-local (localStorage), like query history.
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
}
