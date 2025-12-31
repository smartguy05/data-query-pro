export interface Column {
    name: string
    type: string
    nullable: boolean
    primary_key?: boolean
    foreign_key?: string
    description?: string
    aiDescription?: string
    hidden?: boolean
    isNew?: boolean
    isModified?: boolean
}