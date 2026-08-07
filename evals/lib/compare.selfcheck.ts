// Self-check for compare.ts — run with:
//   node --experimental-strip-types evals/lib/compare.selfcheck.ts
// Prints "compare.selfcheck: N assertions passed" on success; throws on failure.

import assert from "node:assert";
// Explicit .ts extension is required by Node's type stripping; the repo
// tsconfig has no allowImportingTsExtensions, so silence TS5097 here.
// @ts-ignore -- TS5097: importing .ts extension for node --experimental-strip-types
import { compareResults } from "./compare.ts";
import type { ResultSet } from "../types";

let count = 0;
function check(name: string, actual: boolean, expected: boolean): void {
  count++;
  assert.strictEqual(actual, expected, `FAILED: ${name} (expected ${expected}, got ${actual})`);
  console.log(`ok ${count} - ${name}`);
}

function rs(columns: string[], rows: string[][]): ResultSet {
  return { columns, rows };
}

// 1. Numeric tolerance: "29" vs "29.00" (scalar)
check(
  "numeric tolerance 29 vs 29.00",
  compareResults(rs(["avg"], [["29"]]), rs(["a"], [["29.00"]]), "scalar").match,
  true,
);

// 2. NULL sentinel: NULL equals NULL (unordered)
check(
  "NULL sentinel equals NULL",
  compareResults(rs(["c"], [["NULL"]]), rs(["x"], [["NULL"]]), "unordered").match,
  true,
);

// 3. NULL sentinel: NULL does not equal "null" string
check(
  "NULL sentinel is not the string null",
  compareResults(rs(["c"], [["NULL"]]), rs(["x"], [["null"]]), "unordered").match,
  false,
);

// 4. Ordered pass on identical rows
check(
  "ordered pass on identical rows",
  compareResults(
    rs(["n", "v"], [["1", "a"], ["2", "b"]]),
    rs(["num", "val"], [["1", "a"], ["2", "b"]]),
    "ordered",
  ).match,
  true,
);

// 5. Ordered fail on swapped rows
check(
  "ordered fail on swapped rows",
  compareResults(
    rs(["n", "v"], [["1", "a"], ["2", "b"]]),
    rs(["num", "val"], [["2", "b"], ["1", "a"]]),
    "ordered",
  ).match,
  false,
);

// 6. Unordered pass on shuffled rows
check(
  "unordered pass on shuffled rows",
  compareResults(
    rs(["n", "v"], [["1", "a"], ["2", "b"], ["3", "c"]]),
    rs(["num", "val"], [["3", "c"], ["1", "a"], ["2", "b"]]),
    "unordered",
  ).match,
  true,
);

// 7. Extra generated column allowed (unordered)
check(
  "extra generated column allowed",
  compareResults(
    rs(["n"], [["1"], ["2"]]),
    rs(["id", "extra"], [["1", "foo"], ["2", "bar"]]),
    "unordered",
  ).match,
  true,
);

// 8. Missing golden column fails
check(
  "missing golden column fails",
  compareResults(
    rs(["n", "v"], [["1", "a"], ["2", "b"]]),
    rs(["id"], [["1"], ["2"]]),
    "unordered",
  ).match,
  false,
);

// 9. Scalar with extra generated column still passes
check(
  "scalar with extra column",
  compareResults(rs(["total"], [["42"]]), rs(["label", "total"], [["widgets", "42"]]), "scalar").match,
  true,
);

// 10. Row-count mode: equal counts pass, different counts fail
check(
  "row-count equal passes",
  compareResults(
    rs(["a"], [["x"], ["y"]]),
    rs(["b"], [["totally"], ["different"]]),
    "row-count",
  ).match,
  true,
);
check(
  "row-count mismatch fails",
  compareResults(rs(["a"], [["x"], ["y"]]), rs(["b"], [["1"], ["2"], ["3"]]), "row-count").match,
  false,
);

// 11. Non-empty mode: empty fails, one row passes
check(
  "non-empty fails on zero rows",
  compareResults(rs(["a"], [["x"]]), rs(["b"], []), "non-empty").match,
  false,
);
check(
  "non-empty passes on one row",
  compareResults(rs(["a"], [["x"]]), rs(["b"], [["anything"]]), "non-empty").match,
  true,
);

// 12. Date-only vs midnight timestamp
check(
  "date-only equals midnight timestamp",
  compareResults(
    rs(["d"], [["2024-05-01"]]),
    rs(["day"], [["2024-05-01 00:00:00"]]),
    "unordered",
  ).match,
  true,
);

// 13. Unordered multiset trap: per-column multisets match ({1,2} and {x,y})
// but the row pairings differ — must FAIL.
const trap = compareResults(
  rs(["n", "v"], [["1", "x"], ["2", "y"]]),
  rs(["num", "val"], [["1", "y"], ["2", "x"]]),
  "unordered",
);
check("unordered multiset trap fails", trap.match, false);

// 14. Row-count mismatch in ordered fails immediately with detail
const rc = compareResults(rs(["a"], [["1"], ["2"]]), rs(["b"], [["1"]]), "ordered");
check("ordered row-count mismatch fails", rc.match, false);
assert.strictEqual(rc.detail, "row count 2 vs 1", `unexpected detail: ${rc.detail}`);

console.log(`compare.selfcheck: ${count} assertions passed`);
