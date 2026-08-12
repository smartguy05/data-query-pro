import { describe, it, expect, beforeEach } from "vitest"
import { LocalStorageProvider } from "@/lib/storage/local-storage-provider"
import { STORAGE_KEYS } from "@/lib/constants"

describe("LocalStorageProvider dirty-read preference", () => {
  let provider: LocalStorageProvider

  beforeEach(() => {
    localStorage.clear()
    provider = new LocalStorageProvider()
  })

  it("returns null (never set), NOT false, when nothing is stored", () => {
    // The distinction matters: it keeps a future change of default from stomping
    // someone who deliberately turned the setting off.
    return expect(provider.getDirtyRead()).resolves.toBeNull()
  })

  it("round-trips true", async () => {
    await provider.setDirtyRead(true)
    expect(await provider.getDirtyRead()).toBe(true)
  })

  it("round-trips false as a value, not as absence", async () => {
    await provider.setDirtyRead(false)
    expect(await provider.getDirtyRead()).toBe(false)
  })

  it("stores under the documented key in JSON form", async () => {
    await provider.setDirtyRead(true)
    expect(localStorage.getItem(STORAGE_KEYS.DIRTY_READ)).toBe("true")
    await provider.setDirtyRead(false)
    expect(localStorage.getItem(STORAGE_KEYS.DIRTY_READ)).toBe("false")
  })

  it("recovers gracefully from corrupt stored data", async () => {
    localStorage.setItem(STORAGE_KEYS.DIRTY_READ, "not json")
    expect(await provider.getDirtyRead()).toBeNull()
  })

  it('rejects a stringified "false" rather than treating it as truthy', async () => {
    // '"false"' parses to the string "false", which is truthy — the exact bug the
    // type guard exists to prevent.
    localStorage.setItem(STORAGE_KEYS.DIRTY_READ, '"false"')
    expect(await provider.getDirtyRead()).toBeNull()
  })

  it("rejects numeric 1/0 written by some other client", async () => {
    localStorage.setItem(STORAGE_KEYS.DIRTY_READ, "1")
    expect(await provider.getDirtyRead()).toBeNull()
    localStorage.setItem(STORAGE_KEYS.DIRTY_READ, "0")
    expect(await provider.getDirtyRead()).toBeNull()
  })
})
