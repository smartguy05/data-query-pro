import { describe, it, expect } from "vitest"
import { formatMetricValue, computeStatus } from "@/utils/metric-status"

describe("formatMetricValue", () => {
  it("formats plain numbers with locale grouping", () => {
    expect(formatMetricValue(1234, "number")).toBe("1,234")
    expect(formatMetricValue(1234)).toBe("1,234")
  })

  it("formats currency as USD", () => {
    expect(formatMetricValue(1234.5, "currency")).toBe("$1,234.50")
  })

  it("formats percent with a trailing sign", () => {
    expect(formatMetricValue(42, "percent")).toBe("42%")
  })

  it("coerces numeric-looking strings, stripping non-numeric characters", () => {
    expect(formatMetricValue("$1,234.56", "currency")).toBe("$1,234.56")
  })

  it("falls back to the original string when coercion yields NaN", () => {
    // "1.2.3" survives the strip but Number("1.2.3") is NaN -> original returned
    expect(formatMetricValue("1.2.3")).toBe("1.2.3")
  })

  it("coerces nullish values to 0 (the em-dash fallback is unreachable)", () => {
    // null/undefined -> String(value ?? "") === "" -> Number("") === 0, never NaN,
    // so the `String(value ?? "—")` branch is effectively dead code today.
    expect(formatMetricValue(null)).toBe("0")
    expect(formatMetricValue(undefined)).toBe("0")
  })
})

describe("computeStatus", () => {
  it("returns neutral when there is no target", () => {
    expect(computeStatus(100, undefined)).toBe("neutral")
  })

  it("returns neutral when the value is NaN", () => {
    expect(computeStatus(Number.NaN, 100)).toBe("neutral")
  })

  describe("higherIsBetter (default)", () => {
    it("is exceeding at or above target", () => {
      expect(computeStatus(100, 100)).toBe("exceeding")
      expect(computeStatus(120, 100)).toBe("exceeding")
    })

    it("is on-track within 90% of target", () => {
      expect(computeStatus(90, 100)).toBe("on-track")
      expect(computeStatus(95, 100)).toBe("on-track")
    })

    it("is behind below 90% of target", () => {
      expect(computeStatus(50, 100)).toBe("behind")
    })

    it("returns neutral when target is zero", () => {
      expect(computeStatus(50, 0)).toBe("neutral")
    })
  })

  describe("higherIsBetter = false (lower is better)", () => {
    it("is exceeding when value is at or below target", () => {
      expect(computeStatus(80, 100, false)).toBe("exceeding")
      expect(computeStatus(100, 100, false)).toBe("exceeding")
    })

    it("is on-track when slightly above target", () => {
      // target/value = 100/105 ≈ 0.952 -> on-track
      expect(computeStatus(105, 100, false)).toBe("on-track")
    })

    it("is behind when well above target", () => {
      // target/value = 100/200 = 0.5 -> behind
      expect(computeStatus(200, 100, false)).toBe("behind")
    })

    it("treats a value of zero as exceeding", () => {
      expect(computeStatus(0, 100, false)).toBe("exceeding")
    })
  })
})
