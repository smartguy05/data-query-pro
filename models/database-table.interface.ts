import type { Column } from './column.interface';

export interface DatabaseTable {
    name: string
    columns: Column[]
    description?: string
    aiDescription?: string
    hidden?: boolean
    isNew?: boolean
}