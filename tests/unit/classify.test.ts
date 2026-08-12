import { describe, it, expect } from "vitest"
import { classifyExecution, classifyGeneration } from "@/evals/lib/classify"

describe("classifyGeneration", () => {
  it("returns null for a normal generated query", () => {
    expect(classifyGeneration(200, { sql: "SELECT 1", warnings: [] })).toBeNull()
  })

  it("flags the mock fallback and the JSON parse fallback", () => {
    expect(
      classifyGeneration(200, {
        sql: "SELECT * FROM information_schema.columns",
        warnings: ["This is a mock response - configure OpenAI API key"],
      })
    ).toBe("generation-mock-fallback")
    expect(classifyGeneration(200, { sql: "SELECT 1 as parsing_error" })).toBe("json-parse-fallback")
  })

  it("flags non-200 and empty SQL", () => {
    expect(classifyGeneration(500, { error: "boom" })).toBe("generation-error")
    expect(classifyGeneration(200, { sql: "   " })).toBe("generation-error")
  })
})

describe("classifyExecution", () => {
  it("returns null when rows came back", () => {
    expect(classifyExecution(200, { rowCount: 3 })).toBeNull()
  })

  it("flags a 200 with no rows as empty-result", () => {
    expect(classifyExecution(200, { rowCount: 0 })).toBe("empty-result")
  })

  it("flags non-400 failures as execution-error", () => {
    expect(classifyExecution(500, { error: "Failed to execute database operation" })).toBe(
      "execution-error"
    )
    expect(classifyExecution(401, { error: "Unauthorized" })).toBe("execution-error")
  })

  it("uses errorCode to separate validator rejections from database rejections", () => {
    expect(
      classifyExecution(400, {
        error: "Only read-only SELECT queries are allowed (detected: update).",
        errorCode: "SQL_VALIDATION_REJECTED",
      })
    ).toBe("validation-rejection")

    // The model's most common failure: a hallucinated column, sanitized to a
    // 400 user error by utils/error-sanitizer.ts. Not a validator rejection.
    expect(
      classifyExecution(400, {
        error: 'Column "revenue_usd" does not exist',
        errorCode: "DB_USER_ERROR",
      })
    ).toBe("execution-error")

    expect(
      classifyExecution(400, { error: "SQL query is required", errorCode: "SQL_REQUIRED" })
    ).toBe("execution-error")
  })

  it("falls back to the validator's message wording when errorCode is absent", () => {
    for (const error of [
      "Only a single read-only SELECT statement is allowed.",
      "Only a single statement is allowed; multiple statements were detected.",
      "Only read-only SELECT queries are allowed (detected: delete).",
      "No SQL statement found.",
    ]) {
      expect(classifyExecution(400, { error })).toBe("validation-rejection")
    }
  })

  it("treats an unrecognized 400 message as a database rejection", () => {
    expect(classifyExecution(400, { error: 'Column "revenue_usd" does not exist' })).toBe(
      "execution-error"
    )
    expect(classifyExecution(400, { error: "Invalid SQL syntax" })).toBe("execution-error")
    expect(classifyExecution(400, {})).toBe("execution-error")
  })
})
