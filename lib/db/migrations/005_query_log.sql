-- DataQuery Pro: append-only server-side audit log of every executed query.
-- One immutable row per execution attempt (success or failure). Credentials are
-- NEVER stored here. Used for auditing what ran against connected databases.
--
-- Notes:
-- * user_id is nullable (auth is optional) and intentionally has NO foreign key —
--   the audit trail must survive user deletion (unlike query_accuracy_stats, which
--   cascades). When auth is disabled the log is written to a JSONL file instead.
-- * No updated_at / trigger: rows are write-once.

CREATE TABLE IF NOT EXISTS query_log (
    id              BIGSERIAL PRIMARY KEY,
    user_id         TEXT,
    connection_id   TEXT NOT NULL,
    connection_name TEXT,
    database_type   TEXT,
    question        TEXT,
    sql             TEXT NOT NULL,
    source          TEXT,
    success         BOOLEAN NOT NULL,
    row_count       INTEGER,
    duration_ms     INTEGER,
    error           TEXT,
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_log_user_time       ON query_log (user_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_log_connection_time ON query_log (connection_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_log_executed_at     ON query_log (executed_at DESC);
