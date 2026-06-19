import { describe, it, expect } from "vitest"
import { computeSchemaFingerprint } from "@/utils/schema-fingerprint"
import type { Schema } from "@/models/schema.interface"
import type { Column } from "@/models/column.interface"

const col = (name: string): Column => ({ name, type: "text", nullable: true })
const schema = (tables: { name: string; columns: Column[] }[], connectionId = "c1"): Schema => ({
  connectionId,
  tables,
})

describe("computeSchemaFingerprint", () => {
  it("is identical across connections with the same shape", () => {
    const a = schema([{ name: "users", columns: [col("id"), col("name")] }], "dev")
    const b = schema([{ name: "users", columns: [col("id"), col("name")] }], "prod")
    expect(computeSchemaFingerprint(a)).toBe(computeSchemaFingerprint(b))
  })

  it("is order-independent for tables and columns", () => {
    const a = schema([
      { name: "users", columns: [col("id"), col("name")] },
      { name: "orders", columns: [col("id"), col("total")] },
    ])
    const b = schema([
      { name: "orders", columns: [col("total"), col("id")] },
      { name: "users", columns: [col("name"), col("id")] },
    ])
    expect(computeSchemaFingerprint(a)).toBe(computeSchemaFingerprint(b))
  })

  it("ignores name casing", () => {
    const a = schema([{ name: "Users", columns: [col("Id"), col("Name")] }])
    const b = schema([{ name: "users", columns: [col("id"), col("name")] }])
    expect(computeSchemaFingerprint(a)).toBe(computeSchemaFingerprint(b))
  })

  it("changes when a column is renamed", () => {
    const a = schema([{ name: "users", columns: [col("id"), col("name")] }])
    const b = schema([{ name: "users", columns: [col("id"), col("full_name")] }])
    expect(computeSchemaFingerprint(a)).not.toBe(computeSchemaFingerprint(b))
  })

  it("returns empty string for empty/missing schema", () => {
    expect(computeSchemaFingerprint(null)).toBe("")
    expect(computeSchemaFingerprint(undefined)).toBe("")
    expect(computeSchemaFingerprint(schema([]))).toBe("")
  })
})
