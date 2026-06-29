import { describe, it, expect } from "vitest"
import { PostgreSQLQueries } from "@/lib/database/queries/postgresql.queries"
import { SQLServerQueries } from "@/lib/database/queries/sqlserver.queries"
import { defaultSchemaForType, supportsSchemaSwitching } from "@/lib/database/types"

describe("PostgreSQL queries are namespace-scoped", () => {
  it("tables() binds the schema as a parameter (no hardcoded 'public')", () => {
    const q = PostgreSQLQueries.tables("reporting")
    expect(q.params).toEqual(["reporting"])
    expect(q.sql).toContain("schemaname = $1")
    expect(q.sql).not.toContain("'public'")
  })

  it("columnsForTable() binds [table, schema] to $1/$2", () => {
    const q = PostgreSQLQueries.columnsForTable("orders", "reporting")
    expect(q.params).toEqual(["orders", "reporting"])
    expect(q.sql).toContain("c.relname = $1")
    expect(q.sql).toContain("n.nspname = $2")
  })

  it("foreignKeysForTable() binds [table, schema] to $1/$2", () => {
    const q = PostgreSQLQueries.foreignKeysForTable("orders", "reporting")
    expect(q.params).toEqual(["orders", "reporting"])
    expect(q.sql).toContain("n.nspname = $2")
  })
})

describe("SQL Server queries are namespace-scoped", () => {
  it("tables() binds the schema to @schema", () => {
    const q = SQLServerQueries.tables("sales")
    expect(q.params).toEqual(["sales"])
    expect(q.sql).toContain("s.name = @schema")
    expect(q.sql).not.toContain("'dbo'")
  })

  it("columnsForTable() references @tableName before @schema, matching params order", () => {
    const q = SQLServerQueries.columnsForTable("invoice", "sales")
    expect(q.params).toEqual(["invoice", "sales"])
    // The adapter binds params positionally to first-appearance of @placeholders.
    expect(q.sql.indexOf("@tableName")).toBeLessThan(q.sql.indexOf("@schema"))
  })

  it("foreignKeysForTable() references @tableName before @schema", () => {
    const q = SQLServerQueries.foreignKeysForTable("invoice", "sales")
    expect(q.params).toEqual(["invoice", "sales"])
    expect(q.sql.indexOf("@tableName")).toBeLessThan(q.sql.indexOf("@schema"))
  })
})

describe("schema namespace helpers", () => {
  it("defaultSchemaForType returns the conventional default per dialect", () => {
    expect(defaultSchemaForType("postgresql")).toBe("public")
    expect(defaultSchemaForType("sqlserver")).toBe("dbo")
    expect(defaultSchemaForType("mysql")).toBeUndefined()
    expect(defaultSchemaForType("sqlite")).toBeUndefined()
    expect(defaultSchemaForType(undefined)).toBeUndefined()
  })

  it("supportsSchemaSwitching is true only for namespaced databases", () => {
    expect(supportsSchemaSwitching("postgresql")).toBe(true)
    expect(supportsSchemaSwitching("sqlserver")).toBe(true)
    expect(supportsSchemaSwitching("mysql")).toBe(false)
    expect(supportsSchemaSwitching("sqlite")).toBe(false)
  })
})
