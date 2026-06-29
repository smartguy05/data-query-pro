-- Per-namespace schema storage.
--
-- Until now a connection had exactly one introspected schema (connection_id +
-- owner_id). To let users switch between PostgreSQL/SQL Server namespaces and
-- keep each one's tables + descriptions, connection_schemas is now keyed by
-- (connection_id, owner_id, schema_name). Existing rows are backfilled to
-- 'public' via the column default, so nothing breaks.
--
-- The OpenAI file/vector-store ids move here too (one uploaded schema index per
-- namespace) — previously they lived on database_connections, one per connection.

-- Remember which namespace a connection currently has selected (UI preference).
ALTER TABLE database_connections
  ADD COLUMN IF NOT EXISTS active_schema TEXT;

ALTER TABLE connection_schemas
  ADD COLUMN IF NOT EXISTS schema_name TEXT NOT NULL DEFAULT 'public';

ALTER TABLE connection_schemas
  ADD COLUMN IF NOT EXISTS schema_file_id TEXT;

ALTER TABLE connection_schemas
  ADD COLUMN IF NOT EXISTS vector_store_id TEXT;

-- Swap the uniqueness key to include the namespace.
ALTER TABLE connection_schemas
  DROP CONSTRAINT IF EXISTS connection_schemas_connection_id_owner_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'connection_schemas_connection_id_owner_id_schema_name_key'
  ) THEN
    ALTER TABLE connection_schemas
      ADD CONSTRAINT connection_schemas_connection_id_owner_id_schema_name_key
      UNIQUE (connection_id, owner_id, schema_name);
  END IF;
END$$;
