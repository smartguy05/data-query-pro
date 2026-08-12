import { describe, it, expect, beforeEach } from "vitest"
import {
  QUERY_REGISTRY_LIMITS,
  cancelQuery,
  clearQueryRegistry,
  parseQueryId,
  registerQuery,
  registryKey,
  registrySize,
  sweepQueries,
  unregisterQuery,
  type QueryRegistryEntry,
} from "@/lib/database/query-registry"

const UUID_A = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
const UUID_B = "9c858901-8a57-4791-81fe-4c455b099bc9"

/** Minimal entry; `now` is injected everywhere so no test needs fake timers. */
function entry(overrides: Partial<QueryRegistryEntry> = {}): QueryRegistryEntry {
  return {
    controller: new AbortController(),
    ownerKey: "user:1",
    engine: "postgresql",
    cancellable: true,
    startedAt: 1_000,
    ...overrides,
  }
}

describe("parseQueryId", () => {
  it("accepts a well-formed UUID", () => {
    expect(parseQueryId(UUID_A)).toBe(UUID_A)
  })

  it("rejects anything that is not a UUID string", () => {
    const bad: unknown[] = [
      undefined,
      null,
      "",
      42,
      {},
      [],
      true,
      "not-a-uuid",
      UUID_A.slice(0, -1), // too short
      `${UUID_A}0`, // too long
      "3f2504e0-4f89-11d3-9a0c-0305e82c330g", // non-hex character
      `${UUID_A}\n; DROP TABLE users`, // injection-shaped
      "x".repeat(5000), // unbounded input
    ]
    for (const value of bad) {
      expect(parseQueryId(value)).toBeUndefined()
    }
  })
})

describe("query registry", () => {
  beforeEach(() => {
    clearQueryRegistry()
  })

  it("cancels a registered query by aborting its signal", () => {
    const e = entry()
    const key = registryKey("user:1", UUID_A)
    expect(registerQuery(key, e, 1_000)).toBe(true)

    expect(cancelQuery(UUID_A, "user:1", 2_000)).toBe("cancelling")
    expect(e.controller.signal.aborted).toBe(true)
    expect(e.cancelledAt).toBe(2_000)
  })

  it("reports not_found for an unknown id", () => {
    expect(cancelQuery(UUID_A, "user:1")).toBe("not_found")
  })

  it("reports not_found after the query is unregistered (the completion race)", () => {
    const key = registryKey("user:1", UUID_A)
    registerQuery(key, entry(), 1_000)
    unregisterQuery(key)
    expect(cancelQuery(UUID_A, "user:1")).toBe("not_found")
    expect(registrySize()).toBe(0)
  })

  it("is idempotent: a second cancel reports already_cancelled and does not throw", () => {
    const e = entry()
    registerQuery(registryKey("user:1", UUID_A), e, 1_000)

    expect(cancelQuery(UUID_A, "user:1", 2_000)).toBe("cancelling")
    expect(cancelQuery(UUID_A, "user:1", 3_000)).toBe("already_cancelled")
    // The original cancellation timestamp is not overwritten.
    expect(e.cancelledAt).toBe(2_000)
  })

  it("reports not_cancellable without aborting, for engines that cannot cancel", () => {
    const e = entry({ engine: "sqlite", cancellable: false })
    registerQuery(registryKey("user:1", UUID_A), e, 1_000)

    expect(cancelQuery(UUID_A, "user:1")).toBe("not_cancellable")
    // Crucially it must NOT claim to have done something.
    expect(e.controller.signal.aborted).toBe(false)
    // Still not cancellable on a repeat attempt.
    expect(cancelQuery(UUID_A, "user:1")).toBe("not_cancellable")
  })

  it("does not let one owner cancel another owner's query", () => {
    const victim = entry({ ownerKey: "user:victim" })
    registerQuery(registryKey("user:victim", UUID_A), victim, 1_000)

    // Same query id, different owner: the namespaced key simply does not match,
    // which also avoids confirming that someone else's query exists.
    expect(cancelQuery(UUID_A, "user:attacker")).toBe("not_found")
    expect(victim.controller.signal.aborted).toBe(false)
  })

  it("isolates identical query ids belonging to different owners", () => {
    const a = entry({ ownerKey: "user:a" })
    const b = entry({ ownerKey: "user:b" })
    expect(registerQuery(registryKey("user:a", UUID_A), a, 1_000)).toBe(true)
    // Same id under a different owner must not collide with the first.
    expect(registerQuery(registryKey("user:b", UUID_A), b, 1_000)).toBe(true)
    expect(registrySize()).toBe(2)

    expect(cancelQuery(UUID_A, "user:a")).toBe("cancelling")
    expect(a.controller.signal.aborted).toBe(true)
    expect(b.controller.signal.aborted).toBe(false)
  })

  it("returns forbidden when a stored entry's owner disagrees with its key", () => {
    // Defence in depth against a future key-construction bug: the entry is filed
    // under user:a but claims to belong to user:b.
    const mismatched = entry({ ownerKey: "user:b" })
    registerQuery(registryKey("user:a", UUID_A), mismatched, 1_000)

    expect(cancelQuery(UUID_A, "user:a")).toBe("forbidden")
    expect(mismatched.controller.signal.aborted).toBe(false)
  })

  it("refuses a duplicate key instead of orphaning the running query", () => {
    const first = entry()
    const second = entry()
    const key = registryKey("user:1", UUID_A)

    expect(registerQuery(key, first, 1_000)).toBe(true)
    expect(registerQuery(key, second, 1_000)).toBe(false)

    // The original entry is still the one that gets cancelled.
    expect(cancelQuery(UUID_A, "user:1")).toBe("cancelling")
    expect(first.controller.signal.aborted).toBe(true)
    expect(second.controller.signal.aborted).toBe(false)
  })

  it("sweeps entries past the TTL but never within it", () => {
    registerQuery(registryKey("user:1", UUID_A), entry({ startedAt: 1_000 }), 1_000)
    registerQuery(registryKey("user:1", UUID_B), entry({ startedAt: 5_000 }), 5_000)

    // Just before the first entry's TTL elapses, nothing is dropped.
    expect(sweepQueries(1_000 + QUERY_REGISTRY_LIMITS.TTL_MS - 1)).toBe(0)
    expect(registrySize()).toBe(2)

    // At the TTL the older entry goes; the newer one survives.
    expect(sweepQueries(1_000 + QUERY_REGISTRY_LIMITS.TTL_MS)).toBe(1)
    expect(registrySize()).toBe(1)
    expect(cancelQuery(UUID_B, "user:1")).toBe("cancelling")
  })

  it("refuses new registrations when full rather than evicting a live entry", () => {
    const live: QueryRegistryEntry[] = []
    for (let i = 0; i < QUERY_REGISTRY_LIMITS.MAX_ENTRIES; i++) {
      const e = entry({ startedAt: 1_000 })
      live.push(e)
      expect(registerQuery(`user:1:slot-${i}`, e, 1_000)).toBe(true)
    }

    // One more must be rejected — the caller runs it uncancellably rather than
    // us destroying the only handle to an already-running query.
    expect(registerQuery(registryKey("user:1", UUID_A), entry({ startedAt: 1_000 }), 1_000)).toBe(
      false
    )
    expect(registrySize()).toBe(QUERY_REGISTRY_LIMITS.MAX_ENTRIES)
    expect(live.every((e) => !e.controller.signal.aborted)).toBe(true)
  })

  it("frees capacity by sweeping stale entries on registration", () => {
    for (let i = 0; i < QUERY_REGISTRY_LIMITS.MAX_ENTRIES; i++) {
      registerQuery(`user:1:slot-${i}`, entry({ startedAt: 1_000 }), 1_000)
    }
    // Once the old entries age out, the sweep inside registerQuery reclaims room.
    const later = 1_000 + QUERY_REGISTRY_LIMITS.TTL_MS
    expect(registerQuery(registryKey("user:1", UUID_A), entry({ startedAt: later }), later)).toBe(
      true
    )
    expect(registrySize()).toBe(1)
  })
})
