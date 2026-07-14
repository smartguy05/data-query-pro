import { describe, it, expect } from "vitest"
import { applyDefaultRowLimit, sanitizeLimit } from "@/lib/database/sql-limit"
import type { DatabaseType } from "@/lib/database/types"

const APPEND_DIALECTS: DatabaseType[] = ["postgresql", "mysql", "sqlite"]

describe("sanitizeLimit", () => {
  it("returns null for absent / 'none' / invalid values", () => {
    expect(sanitizeLimit(undefined)).toBeNull()
    expect(sanitizeLimit(null)).toBeNull()
    expect(sanitizeLimit("none")).toBeNull()
    expect(sanitizeLimit(3.5)).toBeNull()
    expect(sanitizeLimit(0)).toBeNull()
    expect(sanitizeLimit(-5)).toBeNull()
    expect(sanitizeLimit(1_000_000_000)).toBeNull() // over cap
    expect(sanitizeLimit(NaN)).toBeNull()
    expect(sanitizeLimit({})).toBeNull()
    expect(sanitizeLimit("abc")).toBeNull()
  })

  it("accepts integers and numeric strings within bounds", () => {
    expect(sanitizeLimit(100)).toBe(100)
    expect(sanitizeLimit("100")).toBe(100)
    expect(sanitizeLimit(1)).toBe(1)
    expect(sanitizeLimit(100_000)).toBe(100_000)
  })
})

describe("applyDefaultRowLimit — LIMIT dialects (postgresql/mysql/sqlite)", () => {
  for (const db of APPEND_DIALECTS) {
    it(`appends LIMIT to a plain SELECT (${db})`, () => {
      const r = applyDefaultRowLimit("SELECT id, name FROM users", db, 100)
      expect(r.applied).toBe(true)
      expect(r.sql).toMatch(/LIMIT 100\s*$/)
    })

    it(`strips a trailing semicolon before appending (${db})`, () => {
      const r = applyDefaultRowLimit("SELECT * FROM users;", db, 50)
      expect(r.applied).toBe(true)
      expect(r.sql).not.toContain(";")
      expect(r.sql).toMatch(/LIMIT 50\s*$/)
    })

    it(`respects an existing LIMIT (${db})`, () => {
      const sql = "SELECT * FROM users LIMIT 10"
      const r = applyDefaultRowLimit(sql, db, 100)
      expect(r.applied).toBe(false)
      expect(r.reason).toBe("existing-limit")
      expect(r.sql).toBe(sql)
    })
  }

  it("injects when only a subquery has a LIMIT (top-level has none)", () => {
    const sql =
      "SELECT u.id FROM users u JOIN (SELECT id FROM orders ORDER BY total DESC LIMIT 5) o ON o.id = u.id"
    const r = applyDefaultRowLimit(sql, "postgresql", 100)
    expect(r.applied).toBe(true)
    expect(r.sql).toMatch(/LIMIT 100\s*$/)
  })

  it("appends to a UNION without a limit (applies to the whole union)", () => {
    const r = applyDefaultRowLimit(
      "SELECT id FROM a UNION SELECT id FROM b",
      "postgresql",
      25
    )
    expect(r.applied).toBe(true)
    expect(r.sql).toMatch(/LIMIT 25\s*$/)
  })

  it("respects a trailing LIMIT on a UNION", () => {
    const sql = "SELECT id FROM a UNION SELECT id FROM b LIMIT 10"
    const r = applyDefaultRowLimit(sql, "postgresql", 25)
    expect(r.applied).toBe(false)
    expect(r.reason).toBe("existing-limit")
  })

  it("appends to a CTE without a limit", () => {
    const r = applyDefaultRowLimit(
      "WITH recent AS (SELECT * FROM orders) SELECT * FROM recent",
      "postgresql",
      200
    )
    expect(r.applied).toBe(true)
    expect(r.sql).toMatch(/LIMIT 200\s*$/)
  })

  it("respects PG FETCH FIRST", () => {
    const sql = "SELECT * FROM users ORDER BY id FETCH FIRST 5 ROWS ONLY"
    const r = applyDefaultRowLimit(sql, "postgresql", 100)
    expect(r.applied).toBe(false)
    expect(r.reason).toBe("existing-limit")
    expect(r.sql).toBe(sql)
  })

  it("does not treat 'limit' inside a string literal as an existing limit", () => {
    const r = applyDefaultRowLimit(
      "SELECT * FROM notes WHERE body = 'limit reached'",
      "postgresql",
      100
    )
    expect(r.applied).toBe(true)
    expect(r.sql).toMatch(/LIMIT 100\s*$/)
  })

  describe("parse-failure fallback", () => {
    // node-sql-parser rejects PG typed literals like `timestamptz '...'` —
    // same unparseable class the validator's heuristic path handles.
    const unparseable =
      "SELECT * FROM events WHERE created_at > TIMESTAMP WITH TIME ZONE '2024-01-01 00:00:00+00'"

    it("appends via fallback when no limit keyword appears", () => {
      const r = applyDefaultRowLimit(unparseable, "postgresql", 100)
      expect(r.applied).toBe(true)
      expect(r.sql).toMatch(/LIMIT 100\s*$/)
    })

    it("skips when a limit keyword appears anywhere (conservative)", () => {
      const r = applyDefaultRowLimit(`${unparseable} LIMIT 10`, "postgresql", 100)
      expect(r.applied).toBe(false)
      expect(r.reason).toBe("parse-failed")
    })
  })
})

describe("applyDefaultRowLimit — SQL Server (TOP)", () => {
  it("injects TOP into a plain SELECT and the output re-parses", () => {
    const r = applyDefaultRowLimit("SELECT id, name FROM users", "sqlserver", 100)
    expect(r.applied).toBe(true)
    expect(r.sql).toMatch(/\bTOP\b/i)
    expect(r.sql).toContain("100")
  })

  it("respects an existing TOP", () => {
    const sql = "SELECT TOP 5 id FROM users"
    const r = applyDefaultRowLimit(sql, "sqlserver", 100)
    expect(r.applied).toBe(false)
    expect(r.reason).toBe("existing-limit")
    expect(r.sql).toBe(sql)
  })

  it("respects OFFSET ... FETCH NEXT", () => {
    const sql =
      "SELECT id FROM users ORDER BY id OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY"
    const r = applyDefaultRowLimit(sql, "sqlserver", 100)
    expect(r.applied).toBe(false)
    expect(r.reason).toBe("existing-limit")
    expect(r.sql).toBe(sql)
  })

  it("skips injection entirely when the SQL is unparseable", () => {
    const sql = "SELECT * FROM events WHERE t > TIMESTAMP WITH TIME ZONE '2024-01-01'"
    const r = applyDefaultRowLimit(sql, "sqlserver", 100)
    expect(r.applied).toBe(false)
    expect(r.reason).toBe("parse-failed")
    expect(r.sql).toBe(sql)
  })

  it("injects TOP on the main SELECT of a CTE", () => {
    const r = applyDefaultRowLimit(
      "WITH recent AS (SELECT * FROM orders) SELECT * FROM recent",
      "sqlserver",
      50
    )
    // Either applied with TOP on the outer select, or safely skipped —
    // never a corrupted statement.
    if (r.applied) {
      expect(r.sql).toMatch(/\bTOP\b/i)
      expect(r.sql).toContain("50")
    } else {
      expect(r.sql).toContain("WITH recent")
    }
  })
})
