import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { ApiStorageProvider } from "@/lib/storage/api-storage-provider"

/**
 * The preferences PUT replaces the whole JSONB column (COALESCE in
 * preference-repository.ts), so every writer must read-merge-write. Getting this
 * wrong silently destroys the user's other preferences, which no other test in the
 * suite would catch — hence stubbing fetch here rather than in an integration test.
 */

/** Existing server-side preferences that a write must preserve. */
const EXISTING = {
  defaultQueryLimit: 250,
  dismissedNotifications: ["schema-stale"],
  dirtyRead: false,
}

interface Call {
  url: string
  init?: RequestInit
}

let calls: Call[]

function stubFetch(existing: Record<string, unknown> = EXISTING) {
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      // apiFetch unwraps json.data, so the envelope must be present.
      return {
        ok: true,
        json: async () => ({ success: true, data: { preferences: existing } }),
      } as unknown as Response
    })
  )
}

function putBody(): Record<string, unknown> {
  const put = calls.find((c) => c.init?.method === "PUT")
  expect(put, "expected a PUT to /api/data/preferences").toBeDefined()
  expect(put!.url).toBe("/api/data/preferences")
  return JSON.parse(String(put!.init!.body)).preferences
}

describe("ApiStorageProvider preference writes preserve sibling keys", () => {
  let provider: ApiStorageProvider

  beforeEach(() => {
    provider = new ApiStorageProvider()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("setDirtyRead reads before writing", async () => {
    stubFetch()
    await provider.setDirtyRead(true)

    // A GET must precede the PUT — that read is the whole mechanism.
    expect(calls[0].init?.method).toBeUndefined()
    expect(calls[0].url).toBe("/api/data/preferences")

    const written = putBody()
    expect(written.dirtyRead).toBe(true)
    // The siblings survive.
    expect(written.defaultQueryLimit).toBe(250)
    expect(written.dismissedNotifications).toEqual(["schema-stale"])
  })

  it("setDefaultQueryLimit reads before writing", async () => {
    stubFetch()
    await provider.setDefaultQueryLimit(500)

    const written = putBody()
    expect(written.defaultQueryLimit).toBe(500)
    expect(written.dirtyRead).toBe(false)
    expect(written.dismissedNotifications).toEqual(["schema-stale"])
  })

  it("setDirtyRead(false) persists false rather than dropping the key", async () => {
    stubFetch({ ...EXISTING, dirtyRead: true })
    await provider.setDirtyRead(false)

    const written = putBody()
    expect(written).toHaveProperty("dirtyRead", false)
  })

  it("survives an empty preferences object", async () => {
    stubFetch({})
    await provider.setDirtyRead(true)
    expect(putBody()).toEqual({ dirtyRead: true })
  })
})

describe("ApiStorageProvider preference reads", () => {
  let provider: ApiStorageProvider

  beforeEach(() => {
    provider = new ApiStorageProvider()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns null for dirtyRead when the key is absent (never set)", async () => {
    stubFetch({ defaultQueryLimit: 100 })
    expect(await provider.getDirtyRead()).toBeNull()
  })

  it("distinguishes a stored false from an absent key", async () => {
    stubFetch({ dirtyRead: false })
    expect(await provider.getDirtyRead()).toBe(false)
  })

  it("rejects a non-boolean stored value", async () => {
    stubFetch({ dirtyRead: "true" })
    expect(await provider.getDirtyRead()).toBeNull()
  })

  it("returns null instead of throwing when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down")
      })
    )
    expect(await provider.getDirtyRead()).toBeNull()
  })
})
