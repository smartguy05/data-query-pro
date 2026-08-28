import { describe, it, expect } from "vitest"
import {
  isPlaceholderDescription,
  realAiDescription,
  buildSchemaContextSection,
  buildSiblingColumnsSection,
  findRelatedTables,
  fkTargetTable,
  toSchemaContext,
  DESCRIPTION_CONTEXT_LIMITS,
  type SchemaContext,
} from "@/utils/description-context"

const context: SchemaContext = {
  tables: [
    {
      name: "customers",
      description: "Companies that buy cloud services from us.",
      columns: [
        { name: "id", type: "integer", primary_key: true, description: "Unique customer identifier" },
        { name: "name", type: "text", description: "Legal company name" },
      ],
    },
    {
      name: "invoices",
      description: "Monthly bills issued to customers.",
      columns: [
        { name: "id", type: "integer", primary_key: true },
        { name: "customer_id", type: "integer", foreign_key: "customers.id", description: "Billed customer" },
        { name: "total", type: "numeric" },
      ],
    },
    {
      name: "regions",
      description: "Geographic deployment regions.",
      columns: [{ name: "id", type: "integer", primary_key: true }],
    },
    {
      // Newly added table: no descriptions yet
      name: "invoice_lines",
      columns: [
        { name: "id", type: "integer", primary_key: true },
        { name: "invoice_id", type: "integer", foreign_key: "invoices.id" },
        { name: "amount", type: "numeric" },
      ],
    },
  ],
}

describe("fkTargetTable", () => {
  it("extracts the table from table.column", () => {
    expect(fkTargetTable("customers.id")).toBe("customers")
    expect(fkTargetTable("public.customers.id")).toBe("public.customers")
  })
  it("handles missing / bare values", () => {
    expect(fkTargetTable(undefined)).toBeUndefined()
    expect(fkTargetTable("customers")).toBe("customers")
  })
})

describe("isPlaceholderDescription", () => {
  it("recognises the legacy introspect placeholders", () => {
    expect(isPlaceholderDescription("Table containing call_transcript_segments data")).toBe(true)
    expect(isPlaceholderDescription("id field of type text")).toBe(true)
    expect(isPlaceholderDescription("timestamp_utc field of type timestamp with time zone")).toBe(true)
    expect(isPlaceholderDescription("  id field of type text  ")).toBe(true)
  })
  it("does not flag real descriptions or empty values", () => {
    expect(isPlaceholderDescription("Stores one speaker turn of a transcribed phone call.")).toBe(false)
    expect(isPlaceholderDescription("Table containing customer records, one row per account.")).toBe(false)
    expect(isPlaceholderDescription("")).toBe(false)
    expect(isPlaceholderDescription(undefined)).toBe(false)
    expect(isPlaceholderDescription(null)).toBe(false)
  })
  it("realAiDescription hides placeholders and passes real text through", () => {
    expect(realAiDescription("id field of type text")).toBeUndefined()
    expect(realAiDescription("Unique customer identifier")).toBe("Unique customer identifier")
    expect(realAiDescription(undefined)).toBeUndefined()
  })
})

describe("toSchemaContext", () => {
  it("treats placeholder aiDescriptions as missing", () => {
    const ctx = toSchemaContext([
      {
        name: "t",
        aiDescription: "Table containing t data",
        columns: [
          { name: "id", type: "text", aiDescription: "id field of type text" },
          { name: "note", type: "text", description: "user note", aiDescription: "note field of type text" },
        ],
      },
    ])
    expect(ctx.tables[0].description).toBeUndefined()
    expect(ctx.tables[0].columns[0].description).toBeUndefined()
    expect(ctx.tables[0].columns[1].description).toBe("user note")
  })

  it("drops hidden tables and columns and prefers user descriptions over AI", () => {
    const ctx = toSchemaContext([
      {
        name: "a",
        description: "user",
        aiDescription: "ai",
        columns: [
          { name: "c1", type: "int", aiDescription: "ai col" },
          { name: "secret", type: "text", hidden: true },
        ],
      },
      { name: "hidden_table", hidden: true, columns: [] },
    ])
    expect(ctx.tables.map((t) => t.name)).toEqual(["a"])
    expect(ctx.tables[0].description).toBe("user")
    expect(ctx.tables[0].columns).toEqual([{ name: "c1", type: "int", primary_key: undefined, foreign_key: undefined, description: "ai col" }])
  })
})

describe("findRelatedTables", () => {
  it("returns FK targets first, then tables that reference this one", () => {
    expect(findRelatedTables("invoices", context).map((t) => t.name)).toEqual(["customers", "invoice_lines"])
  })
  it("returns nothing for an unrelated table", () => {
    expect(findRelatedTables("regions", context)).toEqual([])
  })
})

describe("buildSchemaContextSection", () => {
  it("returns empty string without context", () => {
    expect(buildSchemaContextSection("x", null)).toBe("")
    expect(buildSchemaContextSection("x", { tables: [] })).toBe("")
  })

  it("lists related tables with columns and other tables by name, excluding the target", () => {
    const section = buildSchemaContextSection("invoice_lines", context)
    expect(section).toContain("RELATED TABLES")
    expect(section).toContain("- invoices — Monthly bills issued to customers.")
    expect(section).toContain("customer_id (integer, FK → customers.id): Billed customer")
    expect(section).toContain("OTHER TABLES IN THIS DATABASE")
    expect(section).toContain("- customers — Companies that buy cloud services from us.")
    expect(section).toContain("- regions — Geographic deployment regions.")
    // target table itself is never listed
    expect(section).not.toMatch(/^- invoice_lines/m)
    // asks the model to stay consistent with existing descriptions
    expect(section).toContain("stay consistent")
  })

  it("caps the number of other tables", () => {
    const big: SchemaContext = {
      tables: Array.from({ length: DESCRIPTION_CONTEXT_LIMITS.OTHER_TABLES + 10 }, (_, i) => ({
        name: `t${i}`,
        columns: [],
      })),
    }
    const section = buildSchemaContextSection("target", big)
    expect(section).toContain("… (10 more tables)")
  })

  it("truncates long descriptions", () => {
    const long = "x".repeat(500)
    const section = buildSchemaContextSection("a", { tables: [{ name: "a", columns: [] }, { name: "b", description: long, columns: [] }] })
    expect(section).not.toContain(long)
    expect(section).toContain("…")
  })
})

describe("buildSiblingColumnsSection", () => {
  it("lists the other columns with their descriptions", () => {
    const cols = context.tables[0].columns
    const section = buildSiblingColumnsSection(cols, "name")
    expect(section).toContain("OTHER COLUMNS IN THIS TABLE")
    expect(section).toContain("- id (integer, PK): Unique customer identifier")
    expect(section).not.toContain("Legal company name")
  })
  it("returns empty string when there are no siblings", () => {
    expect(buildSiblingColumnsSection([{ name: "only", type: "int" }], "only")).toBe("")
  })
})
