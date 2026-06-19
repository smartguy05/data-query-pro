import { describe, it, expect, vi, beforeEach } from "vitest"

// Capture what the file logger would write, without touching the filesystem.
const appendFileMock = vi.fn().mockResolvedValue(undefined)
vi.mock("node:fs/promises", () => {
  const mkdir = vi.fn().mockResolvedValue(undefined)
  const appendFile = (...args: unknown[]) => appendFileMock(...args)
  return { appendFile, mkdir, default: { appendFile, mkdir } }
})

import { appendLogToFile } from "@/lib/query-log-file"
import type { QueryLogEntry } from "@/lib/db/repositories/query-log-repository"

const CREDENTIAL_KEYS = ["password", "username", "host", "port", "ssl", "filepath", "config"]

beforeEach(() => {
  appendFileMock.mockClear()
})

describe("query audit log (file fallback) never persists credentials", () => {
  it("writes a JSONL line containing only credential-free fields", async () => {
    const entry: QueryLogEntry = {
      userId: "user-1",
      connectionId: "conn-1",
      connectionName: "Prod DB",
      databaseType: "postgresql",
      question: "how many users?",
      sql: "SELECT count(*) FROM users",
      source: "generated",
      success: true,
      rowCount: 1,
      durationMs: 12,
    }

    await appendLogToFile(entry)

    expect(appendFileMock).toHaveBeenCalledTimes(1)
    const [path, line] = appendFileMock.mock.calls[0]
    expect(String(path)).toMatch(/query-log\.jsonl$/)

    const text = String(line)
    for (const key of CREDENTIAL_KEYS) {
      expect(text).not.toContain(`"${key}"`)
    }

    const parsed = JSON.parse(text.trim())
    expect(parsed.sql).toBe("SELECT count(*) FROM users")
    expect(parsed.executedAt).toBeTruthy() // stamped by the logger
    expect(Object.keys(parsed).some((k) => CREDENTIAL_KEYS.includes(k))).toBe(false)
  })
})
