import { describe, it, expect, beforeEach } from "vitest"
import { LocalStorageProvider } from "@/lib/storage/local-storage-provider"
import { STORAGE_KEYS } from "@/lib/constants"

describe("LocalStorageProvider query accuracy", () => {
  let provider: LocalStorageProvider

  beforeEach(() => {
    localStorage.clear()
    provider = new LocalStorageProvider()
  })

  it("defaults to zero when nothing is stored", async () => {
    expect(await provider.getQueryAccuracy()).toEqual({ total: 0, successful: 0 })
  })

  it("records successes and failures via deltas", async () => {
    await provider.applyQueryAccuracyDelta(1, 1) // success
    await provider.applyQueryAccuracyDelta(1, 0) // failure
    await provider.applyQueryAccuracyDelta(1, 1) // success
    expect(await provider.getQueryAccuracy()).toEqual({ total: 3, successful: 2 })
  })

  it("applies an override flip (success -> failure) without changing total", async () => {
    await provider.applyQueryAccuracyDelta(1, 1)
    await provider.applyQueryAccuracyDelta(0, -1) // downvote the success
    expect(await provider.getQueryAccuracy()).toEqual({ total: 1, successful: 0 })
  })

  it("clamps successful at zero and never above total", async () => {
    await provider.applyQueryAccuracyDelta(1, 1)
    await provider.applyQueryAccuracyDelta(0, -1)
    await provider.applyQueryAccuracyDelta(0, -1) // extra downvote should not go negative
    expect((await provider.getQueryAccuracy()).successful).toBe(0)

    await provider.applyQueryAccuracyDelta(0, 5) // upvotes beyond total are capped at total
    const stats = await provider.getQueryAccuracy()
    expect(stats.successful).toBe(stats.total)
  })

  it("recovers gracefully from corrupt stored data", async () => {
    localStorage.setItem(STORAGE_KEYS.QUERY_ACCURACY, "not json")
    expect(await provider.getQueryAccuracy()).toEqual({ total: 0, successful: 0 })
  })
})
