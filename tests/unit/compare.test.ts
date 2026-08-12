import { describe, it, expect } from "vitest"
import { compareResults } from "@/evals/lib/compare"
import type { ResultSet } from "@/evals/types"

function rs(columns: string[], rows: string[][]): ResultSet {
  return { columns, rows }
}

describe("compareResults — cell normalization", () => {
  it("treats 29 and 29.00 as equal (scalar)", () => {
    expect(compareResults(rs(["avg"], [["29"]]), rs(["a"], [["29.00"]]), "scalar").match).toBe(true)
  })

  it("treats NULL as equal to NULL", () => {
    expect(compareResults(rs(["c"], [["NULL"]]), rs(["x"], [["NULL"]]), "unordered").match).toBe(
      true
    )
  })

  it("does not treat the NULL sentinel as the string 'null'", () => {
    expect(compareResults(rs(["c"], [["NULL"]]), rs(["x"], [["null"]]), "unordered").match).toBe(
      false
    )
  })

  it("treats a date-only value as equal to its midnight timestamp", () => {
    expect(
      compareResults(rs(["d"], [["2024-05-01"]]), rs(["day"], [["2024-05-01 00:00:00"]]), "unordered")
        .match
    ).toBe(true)
  })
})

describe("compareResults — ordered", () => {
  it("passes on identical rows", () => {
    expect(
      compareResults(
        rs(["n", "v"], [["1", "a"], ["2", "b"]]),
        rs(["num", "val"], [["1", "a"], ["2", "b"]]),
        "ordered"
      ).match
    ).toBe(true)
  })

  it("fails on swapped rows", () => {
    expect(
      compareResults(
        rs(["n", "v"], [["1", "a"], ["2", "b"]]),
        rs(["num", "val"], [["2", "b"], ["1", "a"]]),
        "ordered"
      ).match
    ).toBe(false)
  })

  it("fails immediately on a row-count mismatch with a detail", () => {
    const outcome = compareResults(rs(["a"], [["1"], ["2"]]), rs(["b"], [["1"]]), "ordered")
    expect(outcome.match).toBe(false)
    expect(outcome.detail).toBe("row count 2 vs 1")
  })
})

describe("compareResults — unordered", () => {
  it("passes on shuffled rows", () => {
    expect(
      compareResults(
        rs(["n", "v"], [["1", "a"], ["2", "b"], ["3", "c"]]),
        rs(["num", "val"], [["3", "c"], ["1", "a"], ["2", "b"]]),
        "unordered"
      ).match
    ).toBe(true)
  })

  it("allows an extra generated column", () => {
    expect(
      compareResults(
        rs(["n"], [["1"], ["2"]]),
        rs(["id", "extra"], [["1", "foo"], ["2", "bar"]]),
        "unordered"
      ).match
    ).toBe(true)
  })

  it("fails when a golden column is missing from the generated result", () => {
    expect(
      compareResults(
        rs(["n", "v"], [["1", "a"], ["2", "b"]]),
        rs(["id"], [["1"], ["2"]]),
        "unordered"
      ).match
    ).toBe(false)
  })

  it("fails when per-column multisets match but the row pairings differ", () => {
    expect(
      compareResults(
        rs(["n", "v"], [["1", "x"], ["2", "y"]]),
        rs(["num", "val"], [["1", "y"], ["2", "x"]]),
        "unordered"
      ).match
    ).toBe(false)
  })

  it("matches duplicate rows one-for-one rather than as a set", () => {
    expect(
      compareResults(
        rs(["v"], [["a"], ["a"], ["b"]]),
        rs(["x"], [["a"], ["b"], ["b"]]),
        "unordered"
      ).match
    ).toBe(false)
  })
})

describe("compareResults — scalar / row-count / non-empty", () => {
  it("passes a scalar match against a row with an extra column", () => {
    expect(
      compareResults(rs(["total"], [["42"]]), rs(["label", "total"], [["widgets", "42"]]), "scalar")
        .match
    ).toBe(true)
  })

  it("passes row-count on equal counts regardless of values", () => {
    expect(
      compareResults(
        rs(["a"], [["x"], ["y"]]),
        rs(["b"], [["totally"], ["different"]]),
        "row-count"
      ).match
    ).toBe(true)
  })

  it("fails row-count on differing counts", () => {
    expect(
      compareResults(rs(["a"], [["x"], ["y"]]), rs(["b"], [["1"], ["2"], ["3"]]), "row-count").match
    ).toBe(false)
  })

  it("fails non-empty on zero rows", () => {
    expect(compareResults(rs(["a"], [["x"]]), rs(["b"], []), "non-empty").match).toBe(false)
  })

  it("passes non-empty on one row", () => {
    expect(compareResults(rs(["a"], [["x"]]), rs(["b"], [["anything"]]), "non-empty").match).toBe(
      true
    )
  })
})

describe("compareResults — numeric tolerance is mode-independent", () => {
  // A rounded aggregate ("4.17" for 25/6) is within the documented 0.01
  // tolerance and must be accepted by every value-comparing mode.
  const goldenAvg = "4.1666666666666667"
  const roundedAvg = "4.17"

  it("accepts a rounded aggregate in scalar mode", () => {
    expect(
      compareResults(rs(["avg"], [[goldenAvg]]), rs(["avg"], [[roundedAvg]]), "scalar").match
    ).toBe(true)
  })

  it("accepts a rounded aggregate in ordered mode", () => {
    expect(
      compareResults(rs(["avg"], [[goldenAvg]]), rs(["avg"], [[roundedAvg]]), "ordered").match
    ).toBe(true)
  })

  it("accepts a rounded aggregate in unordered mode", () => {
    expect(
      compareResults(rs(["avg"], [[goldenAvg]]), rs(["avg"], [[roundedAvg]]), "unordered").match
    ).toBe(true)
  })

  it("accepts rounded aggregates across multiple shuffled rows", () => {
    expect(
      compareResults(
        rs(["region", "avg"], [["east", goldenAvg], ["west", "9.3333333333333333"]]),
        rs(["region", "avg"], [["west", "9.33"], ["east", roundedAvg]]),
        "unordered"
      ).match
    ).toBe(true)
  })

  it("still rejects a difference wider than the tolerance", () => {
    expect(
      compareResults(rs(["avg"], [[goldenAvg]]), rs(["avg"], [["4.2"]]), "unordered").match
    ).toBe(false)
  })
})

describe("compareResults — no separator ambiguity in unordered matching", () => {
  // Rows are compared cell by cell, so a cell that happens to contain the
  // characters a serialized row key would use can never merge two cells into
  // one. SEP is the control character a joined key would have been built with.
  const SEP = "\u0001"

  it("fails when only a concatenation of adjacent cells lines up", () => {
    const outcome = compareResults(
      rs(
        ["k", "a", "b"],
        [
          ["x", "a", `b${SEP}s:c`],
          ["y", `a${SEP}s:b`, "c"],
        ]
      ),
      rs(
        ["k", "a", "b"],
        [
          ["x", `a${SEP}s:b`, "c"],
          ["y", "a", `b${SEP}s:c`],
        ]
      ),
      "unordered"
    )
    expect(outcome.match).toBe(false)
  })

  it("fails when two column values differ only by where the separator falls", () => {
    expect(
      compareResults(
        rs(["v", "w"], [["a", `b${SEP}s:c`]]),
        rs(["v", "w"], [[`a${SEP}s:b`, "c"]]),
        "unordered"
      ).match
    ).toBe(false)
  })

  it("still passes when the separator-bearing rows genuinely match", () => {
    expect(
      compareResults(
        rs(["k", "a"], [["x", `a${SEP}s:b`], ["y", "a"]]),
        rs(["k", "a"], [["y", "a"], ["x", `a${SEP}s:b`]]),
        "unordered"
      ).match
    ).toBe(true)
  })
})
