import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { compareSchemas, hasSchemaChanges, getChangeSummary } from "@/utils/compare-schemas"
import type { Schema } from "@/models/schema.interface"
import type { DatabaseTable } from "@/models/database-table.interface"
import type { Column } from "@/models/column.interface"

const col = (overrides: Partial<Column> & { name: string }): Column => ({
  type: "text",
  nullable: false,
  ...overrides,
})

const table = (name: string, columns: Column[], extra: Partial<DatabaseTable> = {}): DatabaseTable => ({
  name,
  columns,
  ...extra,
})

const schema = (tables: DatabaseTable[], connectionId = "conn-1"): Schema => ({
  connectionId,
  tables,
})

// Quiet the verbose debug logging in the comparison functions.
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("compareSchemas", () => {
  it("marks a table present only in the fresh schema as new", () => {
    const current = schema([table("users", [col({ name: "id" })])])
    const fresh = schema([
      table("users", [col({ name: "id" })]),
      table("orders", [col({ name: "id" })]),
    ])

    const merged = compareSchemas(current, fresh)
    const orders = merged.tables.find((t) => t.name === "orders")!
    const users = merged.tables.find((t) => t.name === "users")!

    expect(orders.isNew).toBe(true)
    // Columns of a brand-new table inherit the fresh table data as-is (no isNew flag set on them here).
    expect(users.isNew).toBe(false)
  })

  it("preserves the connectionId of the current schema", () => {
    const current = schema([table("users", [col({ name: "id" })])], "conn-current")
    const fresh = schema([table("users", [col({ name: "id" })])], "conn-fresh")
    const merged = compareSchemas(current, fresh)
    expect(merged.connectionId).toBe("conn-current")
  })

  it("drops tables that exist in current but not in fresh (deleted from DB)", () => {
    const current = schema([
      table("users", [col({ name: "id" })]),
      table("legacy", [col({ name: "id" })]),
    ])
    const fresh = schema([table("users", [col({ name: "id" })])])
    const merged = compareSchemas(current, fresh)
    expect(merged.tables.map((t) => t.name)).toEqual(["users"])
  })

  it("keeps existing table descriptions/settings when the table is unchanged", () => {
    const current = schema([
      table("users", [col({ name: "id" })], { description: "User accounts", hidden: true }),
    ])
    const fresh = schema([table("users", [col({ name: "id" })], { description: "fresh-desc" })])
    const merged = compareSchemas(current, fresh)
    const users = merged.tables[0]
    expect(users.description).toBe("User accounts")
    expect(users.hidden).toBe(true)
    expect(users.isNew).toBe(false)
  })

  it("marks a column present only in the fresh schema as new", () => {
    const current = schema([table("users", [col({ name: "id" })])])
    const fresh = schema([table("users", [col({ name: "id" }), col({ name: "email" })])])
    const merged = compareSchemas(current, fresh)
    const email = merged.tables[0].columns.find((c) => c.name === "email")!
    expect(email.isNew).toBe(true)
    expect(email.isModified).toBe(false)
  })

  it("marks an existing column with a changed type as modified and updates its type", () => {
    const current = schema([table("users", [col({ name: "age", type: "integer" })])])
    const fresh = schema([table("users", [col({ name: "age", type: "bigint" })])])
    const merged = compareSchemas(current, fresh)
    const age = merged.tables[0].columns.find((c) => c.name === "age")!
    expect(age.isModified).toBe(true)
    expect(age.isNew).toBe(false)
    expect(age.type).toBe("bigint")
  })

  it("does not mark an unchanged column as modified, and preserves its description", () => {
    const current = schema([
      table("users", [col({ name: "id", type: "integer", description: "primary id" })]),
    ])
    const fresh = schema([table("users", [col({ name: "id", type: "integer" })])])
    const merged = compareSchemas(current, fresh)
    const id = merged.tables[0].columns.find((c) => c.name === "id")!
    expect(id.isModified).toBe(false)
    expect(id.isNew).toBe(false)
    expect(id.description).toBe("primary id")
  })

  it("treats undefined/null/false nullable as equivalent (no false-positive modification)", () => {
    const current = schema([table("users", [{ name: "id", type: "int", nullable: undefined as unknown as boolean }])])
    const fresh = schema([table("users", [{ name: "id", type: "int", nullable: false }])])
    const merged = compareSchemas(current, fresh)
    expect(merged.tables[0].columns[0].isModified).toBe(false)
  })

  it("detects a primary_key change as a modification", () => {
    const current = schema([table("users", [col({ name: "id", primary_key: false })])])
    const fresh = schema([table("users", [col({ name: "id", primary_key: true })])])
    const merged = compareSchemas(current, fresh)
    expect(merged.tables[0].columns[0].isModified).toBe(true)
    expect(merged.tables[0].columns[0].primary_key).toBe(true)
  })

  it("detects a foreign_key change as a modification", () => {
    const current = schema([table("orders", [col({ name: "user_id" })])])
    const fresh = schema([table("orders", [col({ name: "user_id", foreign_key: "users.id" })])])
    const merged = compareSchemas(current, fresh)
    expect(merged.tables[0].columns[0].isModified).toBe(true)
    expect(merged.tables[0].columns[0].foreign_key).toBe("users.id")
  })
})

describe("hasSchemaChanges", () => {
  it("returns false when nothing is flagged", () => {
    const s = schema([table("users", [col({ name: "id" })])])
    expect(hasSchemaChanges(s)).toBe(false)
  })

  it("returns true when a table is new", () => {
    const s = schema([table("users", [col({ name: "id" })], { isNew: true })])
    expect(hasSchemaChanges(s)).toBe(true)
  })

  it("returns true when a column is new", () => {
    const s = schema([table("users", [col({ name: "id", isNew: true })])])
    expect(hasSchemaChanges(s)).toBe(true)
  })

  it("returns true when a column is modified", () => {
    const s = schema([table("users", [col({ name: "id", isModified: true })])])
    expect(hasSchemaChanges(s)).toBe(true)
  })
})

describe("getChangeSummary", () => {
  it("counts new tables, new columns, and modified columns", () => {
    const s = schema([
      table("new_table", [col({ name: "a", isNew: true })], { isNew: true }),
      table("users", [
        col({ name: "id" }),
        col({ name: "email", isNew: true }),
        col({ name: "age", isModified: true }),
      ]),
    ])
    const summary = getChangeSummary(s)
    expect(summary).toEqual({ newTables: 1, newColumns: 2, modifiedColumns: 1 })
  })

  it("counts a column as new (not modified) when both flags are set, since isNew is checked first", () => {
    const s = schema([table("users", [col({ name: "id", isNew: true, isModified: true })])])
    const summary = getChangeSummary(s)
    expect(summary.newColumns).toBe(1)
    expect(summary.modifiedColumns).toBe(0)
  })

  it("returns all zeros for an unchanged schema", () => {
    const s = schema([table("users", [col({ name: "id" })])])
    expect(getChangeSummary(s)).toEqual({ newTables: 0, newColumns: 0, modifiedColumns: 0 })
  })
})
