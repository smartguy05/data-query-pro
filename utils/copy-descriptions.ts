import type { Schema } from "@/models/schema.interface"
import type { DatabaseTable } from "@/models/database-table.interface"
import type { Column } from "@/models/column.interface"

/**
 * Copies table/column descriptions (and optionally AI descriptions + visibility flags) from a
 * source connection's schema into a target connection's schema, matching tables and columns by
 * name. Useful for the same database registered across multiple environments (dev/staging/prod):
 * generate or write descriptions once, then copy them to the other connections instead of
 * regenerating.
 *
 * Purely client-side and non-mutating — returns a new Schema (the caller persists it via
 * setSchema and re-uploads to OpenAI through the normal "Save to OpenAI" flow).
 */

export interface CopyDescriptionsOptions {
  /** 'fill-empty' only writes where the target field is blank; 'overwrite' replaces matches. */
  mode: 'fill-empty' | 'overwrite';
  /** Also copy aiDescription fields, not just manual descriptions. */
  includeAiDescriptions: boolean;
  /** Mirror the source's `hidden` flags onto matched tables/columns. */
  includeVisibility: boolean;
}

export interface CopyDescriptionsStats {
  /** Target tables that had a same-name match in the source. */
  tablesMatched: number;
  /** Target tables with no same-name match in the source (left untouched). */
  tablesUnmatched: number;
  tableDescriptionsCopied: number;
  /** Target columns (within matched tables) that had a same-name source match. */
  columnsMatched: number;
  columnDescriptionsCopied: number;
  /** Number of `hidden` flags actually changed on the target (when includeVisibility). */
  visibilityChanged: number;
}

const isEmpty = (value?: string): boolean => !value || value.trim().length === 0;

export function copyDescriptions(
  target: Schema,
  source: Schema,
  options: CopyDescriptionsOptions,
): { schema: Schema; stats: CopyDescriptionsStats } {
  const { mode, includeAiDescriptions, includeVisibility } = options;
  const overwrite = mode === 'overwrite';

  const stats: CopyDescriptionsStats = {
    tablesMatched: 0,
    tablesUnmatched: 0,
    tableDescriptionsCopied: 0,
    columnsMatched: 0,
    columnDescriptionsCopied: 0,
    visibilityChanged: 0,
  };

  const sourceTableMap = new Map<string, DatabaseTable>();
  source.tables.forEach((t) => sourceTableMap.set(t.name, t));

  const mergedTables: DatabaseTable[] = target.tables.map((targetTable) => {
    const sourceTable = sourceTableMap.get(targetTable.name);

    if (!sourceTable) {
      stats.tablesUnmatched++;
      // Clone to avoid mutating context state.
      return { ...targetTable, columns: targetTable.columns.map((c) => ({ ...c })) };
    }

    stats.tablesMatched++;
    const merged: DatabaseTable = { ...targetTable };

    // Table-level description
    if (overwrite ? !isEmpty(sourceTable.description) : isEmpty(merged.description) && !isEmpty(sourceTable.description)) {
      merged.description = sourceTable.description;
      stats.tableDescriptionsCopied++;
    }
    if (includeAiDescriptions) {
      if (overwrite ? !isEmpty(sourceTable.aiDescription) : isEmpty(merged.aiDescription) && !isEmpty(sourceTable.aiDescription)) {
        merged.aiDescription = sourceTable.aiDescription;
        stats.tableDescriptionsCopied++;
      }
    }
    if (includeVisibility && Boolean(merged.hidden) !== Boolean(sourceTable.hidden)) {
      merged.hidden = sourceTable.hidden;
      stats.visibilityChanged++;
    }

    // Column-level
    const sourceColumnMap = new Map<string, Column>();
    sourceTable.columns.forEach((c) => sourceColumnMap.set(c.name, c));

    merged.columns = targetTable.columns.map((targetCol) => {
      const sourceCol = sourceColumnMap.get(targetCol.name);
      if (!sourceCol) {
        return { ...targetCol };
      }

      stats.columnsMatched++;
      const mergedCol: Column = { ...targetCol };

      if (overwrite ? !isEmpty(sourceCol.description) : isEmpty(mergedCol.description) && !isEmpty(sourceCol.description)) {
        mergedCol.description = sourceCol.description;
        stats.columnDescriptionsCopied++;
      }
      if (includeAiDescriptions) {
        if (overwrite ? !isEmpty(sourceCol.aiDescription) : isEmpty(mergedCol.aiDescription) && !isEmpty(sourceCol.aiDescription)) {
          mergedCol.aiDescription = sourceCol.aiDescription;
          stats.columnDescriptionsCopied++;
        }
      }
      if (includeVisibility && Boolean(mergedCol.hidden) !== Boolean(sourceCol.hidden)) {
        mergedCol.hidden = sourceCol.hidden;
        stats.visibilityChanged++;
      }

      return mergedCol;
    });

    return merged;
  });

  return {
    schema: { connectionId: target.connectionId, tables: mergedTables },
    stats,
  };
}
