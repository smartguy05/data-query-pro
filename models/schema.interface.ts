import type { DatabaseTable } from './database-table.interface';

export interface Schema {
    connectionId: string;
    /**
     * Database namespace these tables belong to (PostgreSQL/SQL Server schema).
     * Undefined for legacy records and for databases without a namespace concept
     * (MySQL: schema == database; SQLite: none). Callers should treat undefined
     * as the adapter's default (PostgreSQL: "public", SQL Server: "dbo").
     */
    schema?: string;
    tables: DatabaseTable[];
    /**
     * OpenAI file/vector-store IDs for THIS (connection, schema) pair. Stored per
     * schema so each namespace keeps its own uploaded schema index for query
     * generation (previously these lived on the connection, one per connection).
     */
    schemaFileId?: string;
    vectorStoreId?: string;
}
