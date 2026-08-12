import { describe, it, expect, vi } from "vitest"
import type { TokenUsage } from "@/evals/types"

// pricing.json ships with null rates, so stub the file with real ones to
// exercise rate resolution. $1/M input, $2/M output.
const PRICING_JSON = JSON.stringify({
  per: 1_000_000,
  models: {
    "gpt-5.4": { input: 1, output: 2, cachedInput: null, cacheWrite: null },
  },
})

vi.mock("node:fs", () => {
  const readFileSync = () => PRICING_JSON
  return { readFileSync, default: { readFileSync } }
})

const { computeCost, formatUsd, hasAnyPricing } = await import("@/evals/lib/pricing")

function usage(model: string): TokenUsage {
  return {
    model,
    inputTokens: 1000,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 500,
    reasoningTokens: 200,
    totalTokens: 1500,
  }
}

const EXPECTED_USD = (1000 * 1 + 500 * 2) / 1_000_000

describe("ratesFor (via computeCost)", () => {
  it("prices an exactly configured model", () => {
    const cost = computeCost(usage("gpt-5.4"), "gpt-5.4")
    expect(cost.priced).toBe(true)
    expect(cost.usd).toBeCloseTo(EXPECTED_USD, 10)
  })

  it("prices a dated snapshot of a configured model", () => {
    const cost = computeCost(usage("gpt-5.4-2026-03-17"), "gpt-5.4-2026-03-17")
    expect(cost.priced).toBe(true)
    expect(cost.usd).toBeCloseTo(EXPECTED_USD, 10)
  })

  it("leaves a sibling model that merely shares a prefix unpriced", () => {
    expect(computeCost(usage("gpt-5.4-mini"), "gpt-5.4-mini")).toEqual({ usd: 0, priced: false })
    expect(computeCost(usage("gpt-5.4-turbo"), "gpt-5.4-turbo").priced).toBe(false)
  })

  it("leaves a malformed snapshot suffix unpriced", () => {
    expect(computeCost(usage("gpt-5.4-2026-03"), "gpt-5.4-2026-03").priced).toBe(false)
    expect(computeCost(usage("gpt-5.4-2026-03-17-mini"), "gpt-5.4-2026-03-17-mini").priced).toBe(
      false
    )
    expect(computeCost(usage("gpt-5.42026-03-17"), "gpt-5.42026-03-17").priced).toBe(false)
  })

  it("leaves an entirely unknown model unpriced", () => {
    expect(computeCost(usage("claude-sonnet-4"), "claude-sonnet-4").priced).toBe(false)
    expect(computeCost(undefined, "gpt-5.4")).toEqual({ usd: 0, priced: false })
  })
})

describe("computeCost token accounting", () => {
  it("bills cached and cache-write tokens without double-counting input", () => {
    const cost = computeCost(
      {
        model: "gpt-5.4",
        inputTokens: 1000,
        cachedInputTokens: 400,
        cacheWriteTokens: 100,
        outputTokens: 500,
        reasoningTokens: 200,
        totalTokens: 1500,
      },
      "gpt-5.4"
    )
    // No cachedInput/cacheWrite rates configured → all input bills at $1/M.
    expect(cost.usd).toBeCloseTo(EXPECTED_USD, 10)
  })
})

describe("hasAnyPricing / formatUsd", () => {
  it("reports usable rates", () => {
    expect(hasAnyPricing()).toBe(true)
  })

  it("scales decimals to the magnitude", () => {
    expect(formatUsd(0)).toBe("$0")
    expect(formatUsd(0.001234)).toBe("$0.00123")
    expect(formatUsd(0.4213)).toBe("$0.4213")
    expect(formatUsd(1.239)).toBe("$1.24")
  })
})
