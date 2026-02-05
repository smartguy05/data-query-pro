-- DataQuery Pro: Initial schema for authenticated multi-user mode
-- This migration creates all tables needed for server-side data storage

-- Function to auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users table: synced from Authentik OIDC on login
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    oidc_id     TEXT UNIQUE NOT NULL,
    email       TEXT NOT NULL,
    name        TEXT,
    groups      TEXT[] DEFAULT '{}',
    is_admin    BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_oidc_id ON users(oidc_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Database connections: replaces localStorage databaseConnections
CREATE TABLE IF NOT EXISTS database_connections (
    id              TEXT PRIMARY KEY,
    owner_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,
    host            TEXT DEFAULT '',
    port            TEXT DEFAULT '',
    database_name   TEXT DEFAULT '',
    username        TEXT DEFAULT '',
    password_enc    TEXT DEFAULT '',
    filepath        TEXT,
    description     TEXT,
    status          TEXT DEFAULT 'disconnected',
    schema_file_id  TEXT,
    vector_store_id TEXT,
    source          TEXT DEFAULT 'local',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connections_owner ON database_connections(owner_id);

CREATE TRIGGER set_connections_updated_at
    BEFORE UPDATE ON database_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Connection schemas: replaces localStorage connectionSchemas
CREATE TABLE IF NOT EXISTS connection_schemas (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    connection_id   TEXT NOT NULL,
    owner_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schema_data     JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_schemas_connection ON connection_schemas(connection_id);
CREATE INDEX IF NOT EXISTS idx_schemas_owner ON connection_schemas(owner_id);

CREATE TRIGGER set_schemas_updated_at
    BEFORE UPDATE ON connection_schemas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Saved reports: replaces localStorage saved_reports
CREATE TABLE IF NOT EXISTS saved_reports (
    id                      TEXT PRIMARY KEY,
    connection_id           TEXT NOT NULL,
    owner_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    description             TEXT,
    natural_language_query   TEXT NOT NULL,
    sql                     TEXT NOT NULL,
    explanation             TEXT NOT NULL DEFAULT '',
    warnings                JSONB DEFAULT '[]',
    confidence              REAL DEFAULT 0,
    parameters              JSONB DEFAULT '[]',
    is_favorite             BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    last_modified           TIMESTAMPTZ DEFAULT NOW(),
    last_run                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_owner ON saved_reports(owner_id);
CREATE INDEX IF NOT EXISTS idx_reports_connection ON saved_reports(connection_id);

CREATE TRIGGER set_reports_updated_at
    BEFORE UPDATE ON saved_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Suggestions cache: replaces localStorage suggestions_{connectionId}
CREATE TABLE IF NOT EXISTS suggestions_cache (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    connection_id   TEXT NOT NULL,
    owner_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    suggestions     JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_suggestions_connection ON suggestions_cache(connection_id);

CREATE TRIGGER set_suggestions_updated_at
    BEFORE UPDATE ON suggestions_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- User preferences: replaces localStorage currentDbConnection + other prefs
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id                 TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_connection_id   TEXT,
    preferences             JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER set_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Dismissed notifications: replaces localStorage dismissed_notifications
CREATE TABLE IF NOT EXISTS dismissed_notifications (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_dismissed_user ON dismissed_notifications(user_id);

-- Connection sharing
CREATE TABLE IF NOT EXISTS connection_shares (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    connection_id   TEXT NOT NULL REFERENCES database_connections(id) ON DELETE CASCADE,
    shared_with_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission      TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, shared_with_id)
);

CREATE INDEX IF NOT EXISTS idx_conn_shares_connection ON connection_shares(connection_id);
CREATE INDEX IF NOT EXISTS idx_conn_shares_user ON connection_shares(shared_with_id);

-- Report sharing
CREATE TABLE IF NOT EXISTS report_shares (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    report_id       TEXT NOT NULL REFERENCES saved_reports(id) ON DELETE CASCADE,
    shared_with_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission      TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(report_id, shared_with_id)
);

CREATE INDEX IF NOT EXISTS idx_report_shares_report ON report_shares(report_id);
CREATE INDEX IF NOT EXISTS idx_report_shares_user ON report_shares(shared_with_id);

-- Server connection assignments (admin assigns server-config connections to users/groups)
CREATE TABLE IF NOT EXISTS server_connection_assignments (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    connection_id   TEXT NOT NULL,
    assigned_to     TEXT NOT NULL,
    assigned_type   TEXT NOT NULL CHECK (assigned_type IN ('user', 'group')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, assigned_to, assigned_type)
);

CREATE INDEX IF NOT EXISTS idx_server_assign_connection ON server_connection_assignments(connection_id);
CREATE INDEX IF NOT EXISTS idx_server_assign_to ON server_connection_assignments(assigned_to);
