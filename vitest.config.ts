import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror the "@/*" -> project root alias from tsconfig.json
    alias: {
      "@": resolve(rootDir, "."),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./setupTests.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    // Database driver packages (better-sqlite3, mssql, etc.) are never imported by
    // the pure/component units under test; nothing here needs them.
  },
})
