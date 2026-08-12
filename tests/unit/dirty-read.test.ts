import { describe, it, expect } from "vitest"
import { DIRTY_READ, STORAGE_KEYS, isDirtyRead } from "@/lib/constants"
import { supportsDirtyRead, supportsQueryCancellation } from "@/lib/database/types"
import type { DatabaseType } from "@/lib/database/types"

const ALL_DIALECTS: DatabaseType[] = ["postgresql", "mysql", "sqlserver", "sqlite"]

describe("DIRTY_READ constants", () => {
  it("defaults to OFF", () => {
    // Tripwire: dirty reads return data that may never have been committed, so
    // this must never quietly become the default.
    expect(DIRTY_READ.DEFAULT).toBe(false)
  })

  it("pins the on-disk storage key", () => {
    // Renaming this silently orphans every user's stored preference.
    expect(STORAGE_KEYS.DIRTY_READ).toBe("dirty_read")
  })
})

describe("isDirtyRead", () => {
  it("accepts real booleans", () => {
    expect(isDirtyRead(true)).toBe(true)
    expect(isDirtyRead(false)).toBe(true)
  })

  it('rejects the truthy string "false" — the reason this guard exists', () => {
    // JSON.parse('"false"') yields the STRING "false", which is truthy. Without
    // the guard that becomes a silent, un-clearable "always on".
    expect(isDirtyRead("false")).toBe(false)
    expect(isDirtyRead("true")).toBe(false)
  })

  it("rejects other non-boolean values from untrusted storage", () => {
    const bad: unknown[] = [undefined, null, 0, 1, "", "yes", {}, [], NaN]
    for (const value of bad) {
      expect(isDirtyRead(value)).toBe(false)
    }
  })
})

describe("supportsDirtyRead", () => {
  it("is true only for engines with a real READ UNCOMMITTED mode", () => {
    expect(supportsDirtyRead("mysql")).toBe(true)
    expect(supportsDirtyRead("sqlserver")).toBe(true)
  })

  it("is false for PostgreSQL and SQLite, which have no dirty-read mode", () => {
    // PostgreSQL accepts READ UNCOMMITTED only as a synonym for READ COMMITTED;
    // SQLite's PRAGMA needs shared-cache mode, which better-sqlite3 never enables.
    expect(supportsDirtyRead("postgresql")).toBe(false)
    expect(supportsDirtyRead("sqlite")).toBe(false)
  })

  it("is false for absent or unrecognized types", () => {
    // The UI passes currentConnection?.type, which can be undefined.
    expect(supportsDirtyRead(undefined)).toBe(false)
    expect(supportsDirtyRead("oracle")).toBe(false)
    expect(supportsDirtyRead("")).toBe(false)
  })

  it("returns a boolean for every supported dialect", () => {
    for (const db of ALL_DIALECTS) {
      expect(typeof supportsDirtyRead(db)).toBe("boolean")
    }
  })
})

describe("supportsQueryCancellation", () => {
  it("is false only for SQLite", () => {
    // better-sqlite3 exposes no interrupt AND blocks the event loop, so the server
    // could not even receive the cancel request.
    expect(supportsQueryCancellation("sqlite")).toBe(false)
  })

  it("is true for the engines with a real kill mechanism", () => {
    expect(supportsQueryCancellation("postgresql")).toBe(true)
    expect(supportsQueryCancellation("mysql")).toBe(true)
    expect(supportsQueryCancellation("sqlserver")).toBe(true)
  })
})
