-- Migration 003: Add cascade-delete FK constraints on connection_id
-- Ensures schemas, reports, and suggestions are cleaned up when a connection is deleted

-- Clean up orphan rows referencing connections that no longer exist
DELETE FROM connection_schemas
WHERE connection_id NOT IN (SELECT id FROM database_connections);

DELETE FROM saved_reports
WHERE connection_id NOT IN (SELECT id FROM database_connections);

DELETE FROM suggestions_cache
WHERE connection_id NOT IN (SELECT id FROM database_connections);

-- Add FK constraints with ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_schemas_connection'
      AND table_name = 'connection_schemas'
  ) THEN
    ALTER TABLE connection_schemas
      ADD CONSTRAINT fk_schemas_connection
      FOREIGN KEY (connection_id) REFERENCES database_connections(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_reports_connection'
      AND table_name = 'saved_reports'
  ) THEN
    ALTER TABLE saved_reports
      ADD CONSTRAINT fk_reports_connection
      FOREIGN KEY (connection_id) REFERENCES database_connections(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_suggestions_connection'
      AND table_name = 'suggestions_cache'
  ) THEN
    ALTER TABLE suggestions_cache
      ADD CONSTRAINT fk_suggestions_connection
      FOREIGN KEY (connection_id) REFERENCES database_connections(id) ON DELETE CASCADE;
  END IF;
END$$;
