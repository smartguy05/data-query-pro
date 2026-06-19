import { describe, it, expect } from "vitest"
import { tokenize, scoreByQuestion, topN } from "@/utils/example-relevance"

describe("tokenize", () => {
  it("splits into lowercase word tokens", () => {
    expect([...tokenize("Top Customers by Revenue!")]).toEqual([
      "top",
      "customers",
      "by",
      "revenue",
    ])
  })
  it("handles null/empty", () => {
    expect(tokenize(null).size).toBe(0)
    expect(tokenize("").size).toBe(0)
  })
})

describe("scoreByQuestion + topN", () => {
  const candidates = [
    { question: "total revenue by customer", sql: "SELECT customer_id, SUM(amount) FROM orders GROUP BY customer_id" },
    { question: "list all employees in engineering", sql: "SELECT * FROM employees WHERE dept = 'eng'" },
    { question: "revenue per customer this year", sql: "SELECT customer_id, SUM(amount) FROM orders" },
  ]

  it("ranks the more relevant example higher", () => {
    const scored = scoreByQuestion("show revenue by customer", candidates)
    const best = topN(scored, 1)
    expect(best).toHaveLength(1)
    expect(best[0].question).toMatch(/revenue/)
    expect(best[0].question).not.toContain("employees")
  })

  it("respects the n limit", () => {
    const scored = scoreByQuestion("revenue customer", candidates)
    expect(topN(scored, 2).length).toBeLessThanOrEqual(2)
  })

  it("drops candidates below minScore", () => {
    const scored = scoreByQuestion("completely unrelated banana topic", candidates)
    expect(topN(scored, 5, 0.05)).toHaveLength(0)
  })
})
