-- DataQuery Pro: team-wide pool of learned query corrections (auth mode)
-- Failed->revised SQL pairs captured when a user revises a failed query. Pooled by
-- `schema_fingerprint` (NOT scoped per user) so every authenticated user querying a DB
-- with the same schema benefits. `owner_id` is attribution-only and drives curation
-- rights (author or admin may edit/delete). localStorage holds the same shape, device
-- local, when auth is disabled. See models/query-correction.interface.ts.

CREATE TABLE IF NOT EXISTS query_corrections (
    id                 TEXT PRIMARY KEY,
    schema_fingerprint TEXT NOT NULL,
    owner_id           TEXT REFERENCES users(id) ON DELETE SET NULL,  -- author; SET NULL keeps shared knowledge if the user is removed
    question           TEXT,
    bad_sql            TEXT NOT NULL,
    error              TEXT NOT NULL,
    good_sql           TEXT NOT NULL,
    database_type      TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Primary lookup: corrections for a schema fingerprint, newest first.
CREATE INDEX IF NOT EXISTS idx_query_corrections_fingerprint
    ON query_corrections (schema_fingerprint, created_at DESC);

-- De-dupe identical pooled entries (many users hitting and fixing the same query).
CREATE UNIQUE INDEX IF NOT EXISTS uq_query_corrections_dedup
    ON query_corrections (schema_fingerprint, md5(bad_sql), md5(good_sql));

-- Reuse the shared updated_at trigger fn defined in 001_initial_schema.sql.
DROP TRIGGER IF EXISTS set_query_corrections_updated_at ON query_corrections;
CREATE TRIGGER set_query_corrections_updated_at
    BEFORE UPDATE ON query_corrections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
