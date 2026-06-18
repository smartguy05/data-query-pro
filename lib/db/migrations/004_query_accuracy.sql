-- DataQuery Pro: per-user query accuracy counters (auth mode)
-- Backs the "% Query Accuracy" dashboard stat. Global per user (no connection scope);
-- a running tally rather than per-query rows. localStorage holds the same shape when
-- auth is disabled.

CREATE TABLE IF NOT EXISTS query_accuracy_stats (
    owner_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total       INTEGER NOT NULL DEFAULT 0,
    successful  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_query_accuracy_updated_at ON query_accuracy_stats;
CREATE TRIGGER set_query_accuracy_updated_at
    BEFORE UPDATE ON query_accuracy_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
