import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { sanitizeDbError, sanitizeOpenAIError } from "@/utils/error-sanitizer"

// The sanitizer logs the raw error server-side; silence console noise during tests.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("sanitizeDbError", () => {
  it("returns a generic message for non-Error values", () => {
    const result = sanitizeDbError("just a string")
    expect(result).toEqual({
      message: "An unexpected error occurred",
      code: "UNKNOWN_ERROR",
      isUserError: false,
    })
  })

  it("returns a generic message (no credential leak) for unrecognized errors", () => {
    const result = sanitizeDbError(
      new Error("connect to host db.internal user=admin password=s3cr3t failed somehow")
    )
    expect(result.message).toBe("Failed to execute database operation")
    expect(result.code).toBe("DATABASE_ERROR")
    expect(result.isUserError).toBe(false)
    // Sensitive substrings must not survive into the sanitized message.
    expect(result.message).not.toContain("password")
    expect(result.message).not.toContain("s3cr3t")
    expect(result.message).not.toContain("db.internal")
  })

  it("strips credentials/host details for connection-refused (server) errors", () => {
    const result = sanitizeDbError(
      new Error("connection refused: postgres://admin:hunter2@10.0.0.5:5432/prod")
    )
    expect(result.message).toBe("Database connection failed")
    expect(result.code).toBe("CONNECTION_FAILED")
    expect(result.isUserError).toBe(false)
    expect(result.message).not.toContain("hunter2")
    expect(result.message).not.toContain("admin")
    expect(result.message).not.toContain("10.0.0.5")
    // Server errors never carry a detail field.
    expect(result.detail).toBeUndefined()
  })

  it("keeps authentication-failure errors generic (no credentials)", () => {
    const result = sanitizeDbError(
      new Error("password authentication failed for user \"admin\" with password \"hunter2\"")
    )
    expect(result.message).toBe("Database authentication failed")
    expect(result.code).toBe("AUTH_FAILED")
    expect(result.isUserError).toBe(false)
    expect(result.message).not.toContain("hunter2")
    expect(result.detail).toBeUndefined()
  })

  it("surfaces the driver detail for column-not-found (user) errors", () => {
    const result = sanitizeDbError(new Error('column "emial" does not exist'))
    expect(result.code).toBe("COLUMN_NOT_FOUND")
    expect(result.isUserError).toBe(true)
    // For user errors the specific identifier is surfaced as detail.
    expect(result.detail).toContain("emial")
    expect(result.detail).toContain("does not exist")
    expect(result.message).toBe(result.detail)
  })

  it("normalizes whitespace and strips driver prefixes in the surfaced detail", () => {
    const result = sanitizeDbError(new Error("ERROR:  relation   \"orders\" does not exist"))
    expect(result.code).toBe("TABLE_NOT_FOUND")
    expect(result.isUserError).toBe(true)
    // "ERROR: " prefix stripped, runs of whitespace collapsed, first letter capitalized.
    expect(result.detail).toBe('Relation "orders" does not exist')
  })

  it("maps syntax errors to a safe user-error message", () => {
    const result = sanitizeDbError(new Error("syntax error at or near \"SELCT\""))
    expect(result.code).toBe("SYNTAX_ERROR")
    expect(result.isUserError).toBe(true)
  })

  it("maps SQLite no-such-table to TABLE_NOT_FOUND", () => {
    const result = sanitizeDbError(new Error("SQLITE_ERROR: no such table: customers"))
    expect(result.code).toBe("TABLE_NOT_FOUND")
    expect(result.isUserError).toBe(true)
  })
})

describe("sanitizeOpenAIError", () => {
  it("returns a generic message for non-Error values", () => {
    const result = sanitizeOpenAIError({ unexpected: true })
    expect(result).toEqual({ message: "AI service error", code: "AI_ERROR", isUserError: false })
  })

  it("maps rate-limit / 429 errors", () => {
    expect(sanitizeOpenAIError(new Error("Request failed: 429 rate limit")).code).toBe("AI_RATE_LIMIT")
    expect(sanitizeOpenAIError(new Error("429 Too Many Requests")).code).toBe("AI_RATE_LIMIT")
  })

  it("maps 401 / invalid_api_key as a user error without leaking the key", () => {
    const result = sanitizeOpenAIError(new Error("401 invalid_api_key sk-secret-abc123"))
    expect(result.code).toBe("INVALID_API_KEY")
    expect(result.isUserError).toBe(true)
    expect(result.message).toBe("Invalid API key")
    expect(result.message).not.toContain("sk-secret-abc123")
  })

  it("maps insufficient_quota", () => {
    const result = sanitizeOpenAIError(new Error("insufficient_quota: you exceeded your plan"))
    expect(result.code).toBe("QUOTA_EXCEEDED")
    expect(result.isUserError).toBe(true)
  })

  it("maps context_length_exceeded", () => {
    const result = sanitizeOpenAIError(new Error("context_length_exceeded: too many tokens"))
    expect(result.code).toBe("CONTEXT_TOO_LONG")
    expect(result.isUserError).toBe(true)
  })

  it("returns a generic message for unrecognized OpenAI errors", () => {
    const result = sanitizeOpenAIError(new Error("some unexpected internal failure with token sk-abc"))
    expect(result.code).toBe("AI_ERROR")
    expect(result.message).toBe("AI service error")
    expect(result.message).not.toContain("sk-abc")
  })
})
