/**
 * Compares two schemas and marks new and modified items
 * @param currentSchema - The existing schema in the system
 * @param freshSchema - The newly fetched schema from the database
 * @returns A merged schema with change tracking flags (isNew, isModified)
 */
export function compareSchemas(currentSchema: Schema, freshSchema: Schema): Schema {
    console.log('Comparing schemas:', {
        currentTables: currentSchema.tables.length,
        freshTables: freshSchema.tables.length
    });

    const mergedTables: DatabaseTable[] = [];

    // Create maps for efficient lookup
    const currentTableMap = new Map<string, DatabaseTable>();
    currentSchema.tables.forEach(table => {
        currentTableMap.set(table.name, table);
    });

    // Process tables from the fresh schema
    freshSchema.tables.forEach(freshTable => {
        const currentTable = currentTableMap.get(freshTable.name);

        if (!currentTable) {
            // This is a new table
            console.log(`New table detected: ${freshTable.name}`);
            mergedTables.push({
                ...freshTable,
                isNew: true
            });
        } else {
            // Table exists, compare columns
            console.log(`Comparing table: ${freshTable.name}`);
            const mergedColumns = compareColumns(currentTable.columns, freshTable.columns);

            mergedTables.push({
                ...currentTable, // Keep existing descriptions and settings
                columns: mergedColumns,
                // Don't mark table as new since it exists
                isNew: false
            });
        }
    });

    // Note: We intentionally don't include tables that exist in currentSchema but not in freshSchema
    // This handles the case where tables have been deleted from the database

    return {
        connectionId: currentSchema.connectionId,
        tables: mergedTables
    };
}

/**
 * Compares columns between existing and fresh table data
 * @param currentColumns - Existing columns
 * @param freshColumns - Newly fetched columns
 * @returns Merged column list with change tracking
 */
function compareColumns(currentColumns: Column[], freshColumns: Column[]): Column[] {
    const mergedColumns: Column[] = [];

    // Create map for efficient lookup
    const currentColumnMap = new Map<string, Column>();
    currentColumns.forEach(col => {
        currentColumnMap.set(col.name, col);
    });

    // Process fresh columns
    freshColumns.forEach(freshCol => {
        const currentCol = currentColumnMap.get(freshCol.name);

        if (!currentCol) {
            // New column
            mergedColumns.push({
                ...freshCol,
                isNew: true,
                isModified: false
            });
        } else {
            // Column exists, check if it was modified
            const isModified = hasColumnChanged(currentCol, freshCol);

            mergedColumns.push({
                ...currentCol, // Keep existing descriptions and settings
                // Update structural properties from fresh data
                type: freshCol.type,
                nullable: freshCol.nullable,
                primary_key: freshCol.primary_key,
                foreign_key: freshCol.foreign_key,
                isNew: false,
                isModified
            });
        }
    });

    return mergedColumns;
}

/**
 * Checks if a column's structural properties have changed
 */
function hasColumnChanged(currentCol: Column, freshCol: Column): boolean {
    // Normalize values for comparison (treat undefined, null, and false as equivalent for booleans)
    const typeChanged = currentCol.type !== freshCol.type;
    const nullableChanged = Boolean(currentCol.nullable) !== Boolean(freshCol.nullable);
    const pkChanged = Boolean(currentCol.primary_key) !== Boolean(freshCol.primary_key);

    // For foreign_key, compare the actual values (both can be undefined/null or actual strings)
    const fkChanged = (currentCol.foreign_key || undefined) !== (freshCol.foreign_key || undefined);

    const hasChanged = typeChanged || nullableChanged || pkChanged || fkChanged;

    // Debug logging
    if (hasChanged) {
        console.log(`Column ${currentCol.name} changed:`, {
            typeChanged: typeChanged ? `${currentCol.type} -> ${freshCol.type}` : false,
            nullableChanged: nullableChanged ? `${currentCol.nullable} -> ${freshCol.nullable}` : false,
            pkChanged: pkChanged ? `${currentCol.primary_key} -> ${freshCol.primary_key}` : false,
            fkChanged: fkChanged ? `${currentCol.foreign_key} -> ${freshCol.foreign_key}` : false,
        });
    }

    return hasChanged;
}

/**
 * Checks if a schema has any changes (new or modified items)
 */
export function hasSchemaChanges(schema: Schema): boolean {
    return schema.tables.some(table =>
        table.isNew ||
        table.columns.some(col => col.isNew || col.isModified)
    );
}

/**
 * Gets a summary of schema changes for display
 */
export function getChangeSummary(schema: Schema): {
    newTables: number;
    newColumns: number;
    modifiedColumns: number;
} {
    let newTables = 0;
    let newColumns = 0;
    let modifiedColumns = 0;

    schema.tables.forEach(table => {
        if (table.isNew) {
            newTables++;
        }

        table.columns.forEach(col => {
            if (col.isNew) {
                newColumns++;
            } else if (col.isModified) {
                modifiedColumns++;
            }
        });
    });

    return { newTables, newColumns, modifiedColumns };
}
