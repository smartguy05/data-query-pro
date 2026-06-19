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