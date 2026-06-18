import { describe, it, expect, beforeEach } from "vitest"
import {
  addQueryCorrection,
  getQueryCorrections,
  getCorrectionsForFingerprint,
  updateQueryCorrection,
  deleteQueryCorrection,
} from "@/utils/query-corrections"
import { LocalStorageProvider } from "@/lib/storage/local-storage-provider"
import { CORRECTIONS } from "@/lib/constants"
import type { QueryCorrection } from "@/models/query-correction.interface"

function make(overrides: Partial<QueryCorrection> = {}): QueryCorrection {
  return {
    id: `qc_${Math.random().toString(36).slice(2, 9)}`,
    schemaFingerprint: "abc123",
    question: "how many users",
    badSql: "SELECT * FROM user",
    error: "relation \"user\" does not exist",
    goodSql: "SELECT * FROM users",
    databaseType: "postgresql",
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("query-corrections util (device-local)", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns an empty list when nothing is stored", () => {
    expect(getQueryCorrections()).toEqual([])
    expect(getCorrectionsForFingerprint("abc123")).toEqual([])
  })

  it("adds corrections newest-first", () => {
    const a = make({ id: "a" })
    const b = make({ id: "b" })
    addQueryCorrection(a)
    addQueryCorrection(b)
    expect(getQueryCorrections().map((c) => c.id)).toEqual(["b", "a"])
  })

  it("filters by schema fingerprint (empty fingerprint → none)", () => {
    addQueryCorrection(make({ id: "a", schemaFingerprint: "fp1" }))
    addQueryCorrection(make({ id: "b", schemaFingerprint: "fp2" }))
    expect(getCorrectionsForFingerprint("fp1").map((c) => c.id)).toEqual(["a"])
    expect(getCorrectionsForFingerprint("")).toEqual([])
  })

  it("caps the ring buffer at CORRECTIONS.MAX_ENTRIES", () => {
    for (let i = 0; i < CORRECTIONS.MAX_ENTRIES + 10; i++) {
      addQueryCorrection(make({ id: `c${i}` }))
    }
    expect(getQueryCorrections()).toHaveLength(CORRECTIONS.MAX_ENTRIES)
  })

  it("edits a correction in place by id without changing the id", () => {
    addQueryCorrection(make({ id: "a", goodSql: "SELECT 1" }))
    updateQueryCorrection("a", { goodSql: "SELECT 2", question: "edited" })
    const [c] = getQueryCorrections()
    expect(c.id).toBe("a")
    expect(c.goodSql).toBe("SELECT 2")
    expect(c.question).toBe("edited")
  })

  it("deletes a correction by id", () => {
    addQueryCorrection(make({ id: "a" }))
    addQueryCorrection(make({ id: "b" }))
    deleteQueryCorrection("a")
    expect(getQueryCorrections().map((c) => c.id)).toEqual(["b"])
  })

  it("recovers gracefully from corrupt stored data", () => {
    localStorage.setItem("query_corrections", "not json")
    expect(getQueryCorrections()).toEqual([])
  })
})

describe("LocalStorageProvider correction delegation", () => {
  let provider: LocalStorageProvider

  beforeEach(() => {
    localStorage.clear()
    provider = new LocalStorageProvider()
  })

  it("round-trips corrections by fingerprint", async () => {
    await provider.addQueryCorrection(make({ id: "a", schemaFingerprint: "fp" }))
    const list = await provider.getCorrectionsForFingerprint("fp")
    expect(list.map((c) => c.id)).toEqual(["a"])
  })

  it("updates and deletes through the provider", async () => {
    await provider.addQueryCorrection(make({ id: "a", schemaFingerprint: "fp", goodSql: "SELECT 1" }))
    await provider.updateQueryCorrection("a", { goodSql: "SELECT 2" })
    expect((await provider.getCorrectionsForFingerprint("fp"))[0].goodSql).toBe("SELECT 2")

    await provider.deleteQueryCorrection("a")
    expect(await provider.getCorrectionsForFingerprint("fp")).toEqual([])
  })
})
