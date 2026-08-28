/**
 * Builds the schema-wide context that is injected into the AI description
 * prompts (`/api/schema/generate-descriptions`).
 *
 * The route describes ONE table per request. Without this context the model
 * sees a table in isolation — no neighbouring tables, no FK targets, none of
 * the descriptions that already exist — which is why descriptions generated
 * for tables/columns added later (schema update) read noticeably worse than
 * the originals. These helpers are pure so they can be unit-tested.
 */

export interface ContextColumn {
  name: string
  type: string
  primary_key?: boolean
  /** `"table.column"` as produced by the adapters */
  foreign_key?: string
  /** Best available description: user-written first, then AI */
  description?: string
}

export interface ContextTable {
  name: string
  description?: string
  columns: ContextColumn[]
}

export interface SchemaContext {
  tables: ContextTable[]
}

/** Caps keep the prompt bounded on very large schemas. */
export const DESCRIPTION_CONTEXT_LIMITS = {
  /** Max related (FK-linked) tables listed with their full column lists */
  RELATED_TABLES: 12,
  /** Max columns shown per related table */
  RELATED_COLUMNS: 25,
  /** Max "other" tables listed by name + description */
  OTHER_TABLES: 150,
  /** Max sibling columns listed in a column prompt */
  SIBLING_COLUMNS: 40,
  /** Truncate any single description to this many chars */
  DESCRIPTION_CHARS: 160,
} as const

/**
 * Legacy placeholder strings that `/api/schema/introspect` used to stamp into
 * `aiDescription` ("Table containing X data", "X field of type Y"). They were
 * never produced by the model, yet they made tables look "already described",
 * so generation skipped them. Treat them as *no description* everywhere.
 */
const PLACEHOLDER_PATTERNS = [/^Table containing .+ data$/, /^.+ field of type .+$/]

export function isPlaceholderDescription(text?: string | null): boolean {
  if (!text) return false
  const t = text.trim()
  return PLACEHOLDER_PATTERNS.some((re) => re.test(t))
}

/** `aiDescription` with legacy placeholders treated as absent. */
export function realAiDescription(text?: string | null): string | undefined {
  return text && !isPlaceholderDescription(text) ? text : undefined
}

/** Extracts the referenced table name from a `"table.column"` FK string. */
export function fkTargetTable(fk?: string): string | undefined {
  if (!fk) return undefined
  const idx = fk.lastIndexOf(".")
  return idx > 0 ? fk.slice(0, idx) : fk
}

function truncate(text: string | undefined, max = DESCRIPTION_CONTEXT_LIMITS.DESCRIPTION_CHARS): string | undefined {
  if (!text) return undefined
  const t = text.trim().replace(/\s+/g, " ")
  if (!t) return undefined
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function formatColumn(col: ContextColumn): string {
  const flags: string[] = []
  if (col.primary_key) flags.push("PK")
  if (col.foreign_key) flags.push(`FK → ${col.foreign_key}`)
  const head = `${col.name} (${col.type}${flags.length ? ", " + flags.join(", ") : ""})`
  const desc = truncate(col.description)
  return desc ? `${head}: ${desc}` : head
}

/**
 * Converts a full schema (as stored by the app) into the compact shape sent to
 * the API. Hidden tables/columns are dropped, user descriptions win over AI.
 */
export function toSchemaContext(
  tables: Array<{
    name: string
    hidden?: boolean
    description?: string
    aiDescription?: string
    columns: Array<{
      name: string
      type: string
      hidden?: boolean
      primary_key?: boolean
      foreign_key?: string
      description?: string
      aiDescription?: string
    }>
  }>,
): SchemaContext {
  return {
    tables: tables
      .filter((t) => !t.hidden)
      .map((t) => ({
        name: t.name,
        description: t.description || realAiDescription(t.aiDescription),
        columns: t.columns
          .filter((c) => !c.hidden)
          .map((c) => ({
            name: c.name,
            type: c.type,
            primary_key: c.primary_key || undefined,
            foreign_key: c.foreign_key || undefined,
            description: c.description || realAiDescription(c.aiDescription),
          })),
      })),
  }
}

/**
 * Tables related to `tableName` through foreign keys in either direction,
 * in a stable order (outgoing targets first, then incoming referrers).
 */
export function findRelatedTables(tableName: string, context: SchemaContext): ContextTable[] {
  const byName = new Map(context.tables.map((t) => [t.name, t]))
  const target = byName.get(tableName)
  const related = new Map<string, ContextTable>()

  // Outgoing: tables this table's FKs point at
  target?.columns.forEach((col) => {
    const ref = fkTargetTable(col.foreign_key)
    if (ref && ref !== tableName && byName.has(ref)) related.set(ref, byName.get(ref)!)
  })

  // Incoming: tables whose FKs point at this table
  context.tables.forEach((t) => {
    if (t.name === tableName || related.has(t.name)) return
    if (t.columns.some((c) => fkTargetTable(c.foreign_key) === tableName)) related.set(t.name, t)
  })

  return Array.from(related.values())
}

/**
 * Prompt section describing the rest of the database around `tableName`.
 * Returns "" when there is nothing useful to add.
 */
export function buildSchemaContextSection(tableName: string, context?: SchemaContext | null): string {
  if (!context?.tables?.length) return ""

  const related = findRelatedTables(tableName, context).slice(0, DESCRIPTION_CONTEXT_LIMITS.RELATED_TABLES)
  const relatedNames = new Set(related.map((t) => t.name))
  const others = context.tables.filter((t) => t.name !== tableName && !relatedNames.has(t.name))

  const parts: string[] = []

  if (related.length) {
    const lines = related.map((t) => {
      const desc = truncate(t.description)
      const cols = t.columns.slice(0, DESCRIPTION_CONTEXT_LIMITS.RELATED_COLUMNS).map(formatColumn)
      const more = t.columns.length > cols.length ? `, … (${t.columns.length - cols.length} more)` : ""
      return `- ${t.name}${desc ? ` — ${desc}` : ""}\n  Columns: ${cols.join("; ")}${more}`
    })
    parts.push(`RELATED TABLES (linked by foreign keys):\n${lines.join("\n")}`)
  }

  if (others.length) {
    const shown = others.slice(0, DESCRIPTION_CONTEXT_LIMITS.OTHER_TABLES)
    const lines = shown.map((t) => {
      const desc = truncate(t.description)
      return `- ${t.name}${desc ? ` — ${desc}` : ""}`
    })
    const more = others.length > shown.length ? `\n- … (${others.length - shown.length} more tables)` : ""
    parts.push(`OTHER TABLES IN THIS DATABASE:\n${lines.join("\n")}${more}`)
  }

  if (!parts.length) return ""
  return `${parts.join("\n\n")}

Use the existing descriptions above to stay consistent in terminology, tone and level of detail, and to explain how this table relates to the rest of the system.`
}

/**
 * Prompt section listing the other columns of the same table (with their
 * existing descriptions) so a newly added column is described in context and
 * in the same style as its siblings.
 */
export function buildSiblingColumnsSection(
  columns: ContextColumn[],
  currentColumnName: string,
): string {
  const siblings = columns.filter((c) => c.name !== currentColumnName)
  if (!siblings.length) return ""
  const shown = siblings.slice(0, DESCRIPTION_CONTEXT_LIMITS.SIBLING_COLUMNS)
  const more = siblings.length > shown.length ? `\n- … (${siblings.length - shown.length} more columns)` : ""
  return `OTHER COLUMNS IN THIS TABLE:\n${shown.map((c) => `- ${formatColumn(c)}`).join("\n")}${more}`
}
