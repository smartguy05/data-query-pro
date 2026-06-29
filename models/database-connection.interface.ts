import type { DatabaseType } from '@/lib/database';

export interface DatabaseConnection {
    id: string
    name: string
    type: DatabaseType
    host: string
    port: string
    database: string
    username: string
    password: string
    filepath?: string  // SQLite database file path
    description?: string
    status: "connected" | "disconnected"
    // Currently-selected database namespace (PostgreSQL/SQL Server schema). When
    // unset, the adapter default is used ("public" / "dbo"). Switching schemas
    // updates this; the introspected tables for each namespace are cached
    // separately keyed by (connectionId, schema). See [[Schema]].
    activeSchema?: string;
    // Legacy per-connection OpenAI ids. New code stores these per-namespace on
    // the Schema record instead; kept here for back-compat with existing data
    // and as a fallback for the default schema.
    schemaFileId?: string;
    vectorStoreId?: string;
    createdAt: string,
    source?: "local" | "server"  // Track if connection is from server config file

    // Sharing (auth mode only). Set server-side by getConnectionsForUser.
    // undefined ⇒ owned (e.g. localStorage mode); "owner" ⇒ owned in auth mode;
    // "view"/"edit" ⇒ shared with the current user at that permission.
    accessLevel?: "owner" | "view" | "edit"
    sharedByEmail?: string   // owner's email, shown on "Shared with you" items
    sharedByName?: string | null
}