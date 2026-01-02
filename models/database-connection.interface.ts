import type { DatabaseType } from '@/lib/database';

interface DatabaseConnection {
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
}