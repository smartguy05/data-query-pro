-- Migration 002: DB-managed server connections
-- Allows server connections to be stored in PostgreSQL (no owner) when auth is enabled

-- Allow server connections to have no owner (they're admin-managed, not user-owned)
ALTER TABLE database_connections ALTER COLUMN owner_id DROP NOT NULL;

-- Drop the existing FK constraint on owner_id and re-add to allow NULLs
-- (The original constraint was NOT NULL + FK, now just FK)
ALTER TABLE database_connections DROP CONSTRAINT IF EXISTS database_connections_owner_id_fkey;
ALTER TABLE database_connections
  ADD CONSTRAINT database_connections_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_connections_source ON database_connections(source);

-- Clean up orphan assignments that reference non-existent connections
DELETE FROM server_connection_assignments
WHERE connection_id NOT IN (SELECT id FROM database_connections);

-- Add FK constraint so assignments cascade-delete when connection is removed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_server_assign_connection'
      AND table_name = 'server_connection_assignments'
  ) THEN
    ALTER TABLE server_connection_assignments
      ADD CONSTRAINT fk_server_assign_connection
      FOREIGN KEY (connection_id) REFERENCES database_connections(id) ON DELETE CASCADE;
  END IF;
END$$;
