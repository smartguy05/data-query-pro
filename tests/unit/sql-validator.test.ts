import { describe, it, expect } from "vitest"
import { validateReadOnlySql } from "@/lib/database/sql-validator"
import type { DatabaseType } from "@/lib/database/types"

const DIALECTS: DatabaseType[] = ["postgresql", "mysql", "sqlserver", "sqlite"]

describe("validateReadOnlySql", () => {
  describe("allows a single read-only SELECT", () => {
    for (const db of DIALECTS) {
      it(`SELECT passes (${db})`, () => {
        const r = validateReadOnlySql("SELECT id, name FROM users WHERE id = 1", db)
        expect(r.valid).toBe(true)
        expect(r.statementType).toBe("select")
      })
    }

    it("allows a CTE (WITH ... SELECT)", () => {
      const r = validateReadOnlySql(
        "WITH recent AS (SELECT * FROM orders) SELECT * FROM recent",
        "postgresql"
      )
      expect(r.valid).toBe(true)
    })
  })

  describe("rejects writes and DDL", () => {
    const writes = [
      "UPDATE users SET name = 'x'",
      "DELETE FROM users WHERE id = 1",
      "INSERT INTO users (name) VALUES ('x')",
      "DROP TABLE users",
      "CREATE TABLE t (id int)",
      "ALTER TABLE users ADD COLUMN x int",
      "TRUNCATE TABLE users",
    ]
    for (const sql of writes) {
      it(`rejects: ${sql}`, () => {
        const r = validateReadOnlySql(sql, "postgresql")
        expect(r.valid).toBe(false)
        expect(r.error).toBeTruthy()
      })
    }
  })

  it("rejects multiple statements (stacked queries)", () => {
    const r = validateReadOnlySql("SELECT 1; DROP TABLE users", "postgresql")
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/single statement/i)
  })

  it("rejects unparseable SQL (fails closed)", () => {
    const r = validateReadOnlySql("this is not sql at all ;;", "postgresql")
    expect(r.valid).toBe(false)
  })

  it("rejects empty input", () => {
    expect(validateReadOnlySql("", "postgresql").valid).toBe(false)
    expect(validateReadOnlySql("   ", "postgresql").valid).toBe(false)
  })

  it("rejects a write even when dialect-specific", () => {
    expect(validateReadOnlySql("DELETE FROM t WHERE id = 1", "mysql").valid).toBe(false)
    expect(validateReadOnlySql("UPDATE t SET a = 1", "sqlserver").valid).toBe(false)
  })

  describe("heuristic fallback for valid SQL the parser can't parse", () => {
    it("allows a PostgreSQL TIMESTAMP WITH TIME ZONE date-range query", () => {
      const sql = `SELECT c.id AS client_id, c.name AS client_display, COUNT(fp.id) AS flight_count
        FROM flight_plans AS fp
        JOIN clients AS c ON fp.client_id = c.id
        WHERE fp.confirmed_date >= TIMESTAMP WITH TIME ZONE '2026-01-01 00:00:00+00'
          AND fp.confirmed_date < TIMESTAMP WITH TIME ZONE '2027-01-01 00:00:00+00'
          AND c.deleted IS NULL
        GROUP BY c.id, c.name
        ORDER BY flight_count DESC
        LIMIT 100`
      expect(validateReadOnlySql(sql, "postgresql").valid).toBe(true)
    })

    it("allows a timestamptz typed literal", () => {
      expect(validateReadOnlySql("SELECT * FROM t WHERE d > timestamptz '2026-01-01'", "postgresql").valid).toBe(true)
    })

    it("does NOT flag a column named 'deleted'", () => {
      expect(validateReadOnlySql("SELECT * FROM clients WHERE deleted IS NULL AND d > timestamptz '2026-01-01'", "postgresql").valid).toBe(true)
    })

    // Attack cases that must still be blocked when reached via the fallback path.
    it("blocks a data-modifying CTE (unparseable + write keyword)", () => {
      // craft something the parser rejects but that contains a write
      expect(validateReadOnlySql("WITH x AS (DELETE FROM t WHERE d > timestamptz '2026-01-01' RETURNING *) SELECT * FROM x", "postgresql").valid).toBe(false)
    })

    it("blocks SELECT ... INTO (table creation)", () => {
      expect(validateReadOnlySql("SELECT * INTO newtab FROM t WHERE d > timestamptz '2026-01-01'", "postgresql").valid).toBe(false)
    })

    it("blocks stacked statements that fail to parse", () => {
      expect(validateReadOnlySql("SELECT d > timestamptz '2026-01-01' FROM t; DROP TABLE t", "postgresql").valid).toBe(false)
    })
  })
})
