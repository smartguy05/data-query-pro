import type { DatabaseTable } from './database-table.interface';

export interface Schema {
    connectionId: string;
    tables: DatabaseTable[]
}