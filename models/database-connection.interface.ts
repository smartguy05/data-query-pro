export interface DatabaseConnection {
    id: string
    name: string
    type: string
    host: string
    port: string
    database: string
    username: string
    password: string
    description?: string
    status: "connected" | "disconnected"
    schemaFileId?: string;
    vectorStoreId?: string;
    createdAt: string,
}