-- DataQuery Pro Multi-User Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (populated from Azure SSO)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    azure_oid VARCHAR(255) UNIQUE,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Index for email lookups (used during login)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_azure_oid ON users(azure_oid);

-- Database connections (admin-managed)
CREATE TABLE database_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'postgresql',
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    database VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    description TEXT,
    schema_file_id VARCHAR(255),
    vector_store_id VARCHAR(255),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for connection lookups
CREATE INDEX idx_database_connections_created_by ON database_connections(created_by);

-- User-to-connection permissions (many-to-many)
CREATE TABLE connection_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES database_connections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(connection_id, user_id)
);

-- Indexes for permission lookups
CREATE INDEX idx_connection_permissions_user ON connection_permissions(user_id);
CREATE INDEX idx_connection_permissions_connection ON connection_permissions(connection_id);

-- Schemas (one per connection, admin-managed)
CREATE TABLE connection_schemas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID UNIQUE NOT NULL REFERENCES database_connections(id) ON DELETE CASCADE,
    schema_data JSONB NOT NULL,
    last_introspected TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Saved reports (per user, can be shared)
CREATE TABLE saved_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES database_connections(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    natural_language_query TEXT NOT NULL,
    sql TEXT NOT NULL,
    explanation TEXT,
    warnings JSONB DEFAULT '[]',
    confidence DECIMAL(3,2),
    parameters JSONB,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_run TIMESTAMP WITH TIME ZONE
);

-- Indexes for report lookups
CREATE INDEX idx_saved_reports_owner ON saved_reports(owner_id);
CREATE INDEX idx_saved_reports_connection ON saved_reports(connection_id);
CREATE INDEX idx_saved_reports_shared ON saved_reports(is_shared) WHERE is_shared = TRUE;

-- AI suggestions (per user, per connection)
CREATE TABLE user_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES database_connections(id) ON DELETE CASCADE,
    suggestions JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, connection_id)
);

-- Index for suggestion lookups
CREATE INDEX idx_user_suggestions_user_connection ON user_suggestions(user_id, connection_id);

-- Dismissed notifications (per user)
CREATE TABLE dismissed_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id VARCHAR(255) NOT NULL,
    dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, notification_id)
);

-- Index for notification lookups
CREATE INDEX idx_dismissed_notifications_user ON dismissed_notifications(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic updated_at
CREATE TRIGGER update_database_connections_updated_at
    BEFORE UPDATE ON database_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connection_schemas_updated_at
    BEFORE UPDATE ON connection_schemas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_reports_updated_at
    BEFORE UPDATE ON saved_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_suggestions_updated_at
    BEFORE UPDATE ON user_suggestions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE users IS 'Users authenticated via Azure SSO. First user becomes admin.';
COMMENT ON TABLE database_connections IS 'Database connections managed by admins. Passwords are AES-256 encrypted.';
COMMENT ON TABLE connection_permissions IS 'Maps users to connections they can access.';
COMMENT ON TABLE connection_schemas IS 'Introspected schema data per connection, stored as JSONB.';
COMMENT ON TABLE saved_reports IS 'User-saved reports. Can be shared with other users on same connection.';
COMMENT ON TABLE user_suggestions IS 'AI-generated metric suggestions cached per user per connection.';
COMMENT ON TABLE dismissed_notifications IS 'Tracks which notifications each user has dismissed.';
