/**
 * Dashboard KPI metric helpers.
 *
 * Extracted from app/page.tsx so the value-formatting and status-vs-target logic
 * that powers the pinned-report KPI strip can be unit-tested in isolation.
 */

/** Status of a KPI value relative to its target. Mirrors KpiStatus in components/executive-metrics.tsx. */
export type MetricStatus = "exceeding" | "on-track" | "behind" | "neutral"

export type MetricUnit = "number" | "currency" | "percent"

/**
 * Format a raw metric value for display.
 *
 * Coerces the value to a number (stripping anything that isn't a digit, dot, or
 * minus sign) and formats by unit. Non-numeric values fall back to their string
 * form, or an em dash when nullish.
 */
export function formatMetricValue(value: unknown, unit?: MetricUnit): string {
  const num = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  if (Number.isNaN(num)) return String(value ?? "—")
  switch (unit) {
    case "currency":
      return num.toLocaleString("en-US", { style: "currency", currency: "USD" })
    case "percent":
      return `${num.toLocaleString("en-US")}%`
    default:
      return num.toLocaleString("en-US")
  }
}

/**
 * Compute a metric's status relative to its target.
 *
 * When `higherIsBetter` (default), the ratio is value/target; otherwise it is
 * target/value (so a lower value scores better). A ratio >= 1 is "exceeding",
 * >= 0.9 is "on-track", below that is "behind". Returns "neutral" when there is
 * no target or the value isn't a number. Division-by-zero edge cases:
 *   - higherIsBetter with target 0 -> "neutral"
 *   - !higherIsBetter with value 0 -> "exceeding" (can't do better than zero)
 */
export function computeStatus(value: number, target?: number, higherIsBetter: boolean = true): MetricStatus {
  if (target === undefined || Number.isNaN(value)) return "neutral"
  let ratio: number
  if (higherIsBetter) {
    if (target === 0) return "neutral"
    ratio = value / target
  } else {
    if (value === 0) return "exceeding"
    ratio = target / value
  }
  if (ratio >= 1) return "exceeding"
  if (ratio >= 0.9) return "on-track"
  return "behind"
}
