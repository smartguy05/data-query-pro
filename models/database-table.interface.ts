interface DatabaseTable {
    name: string
    columns: Column[]
    description?: string
    aiDescription?: string
    hidden?: boolean
}