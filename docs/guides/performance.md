# Performance & Tuning

Guide to the performance characteristics of DataQuery Pro and the knobs you can turn to control resource usage, latency, and OpenAI cost.

This guide reflects how the code actually behaves today. Where a value is hardcoded (not configurable), that is called out explicitly so you don't go looking for a config key that doesn't exist.

## At a Glance

| Area | Mechanism | Tunable? |
|------|-----------|----------|
| App DB pool (auth mode) | `postgres` pool in `lib/db/pool.ts` | Hardcoded `max: 20`, `idle_timeout: 30`, `connect_timeout: 10` |
| User database connections | New connection per query via adapters | No pooling — connection cost paid per request |
| Read-only enforcement | AST validation (`node-sql-parser`) + per-dialect read-only transaction | Adds a parse step + (for PG/MySQL/SQL Server) a transaction round-trip per query |
| Query audit log | Fire-and-forget `logQuery()` → app DB or JSONL file | Off the hot path — never blocks query execution |
| Production build | `output: 'standalone'` in `next.config.mjs` | Build-time setting |
| OpenAI cost / abuse control | `DEMO_RATE_LIMIT` + BYOK | `DEMO_RATE_LIMIT` env var; users supply own key |
| Schema introspection progress | Background task + 2s client polling | Poll interval hardcoded to 2000ms |
| Chart rendering | recharts (client-side) | N/A (client render budget) |

---

## App Database Connection Pooling (Auth Mode)

The **app database** (the PostgreSQL store that holds users, connections, schemas, reports, etc. when auth is enabled) uses a single shared connection pool created by the `postgres` npm package.

The pool lives in `lib/db/pool.ts`:

```ts
pool = postgres(process.env.APP_DATABASE_URL!, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
});
```

Key points:

- **Lazily created and memoized.** `getAppDb()` returns `null` when `APP_DATABASE_URL` is unset (i.e. default / no-auth mode — there is no app DB at all). When the URL is set, the pool is created on first call and the same instance is reused for the life of the process via a module-level `pool` variable.
- **`max: 20`** — up to 20 concurrent connections to the app DB. This is the cap that matters under load; every repository call in `lib/db/repositories/*` borrows from this pool.
- **`idle_timeout: 30`** — idle connections are closed after 30 seconds.
- **`connect_timeout: 10`** — fail a new connection attempt after 10 seconds.

These three values are **hardcoded** in `pool.ts`. There is no environment variable for them today. If you need to tune the pool (for example, raising `max` for a high-traffic multi-user deployment, or lowering it to fit a small managed Postgres tier's connection limit), edit `pool.ts` directly. When sizing `max`, account for the fact that the pool is **per process** — running multiple app instances multiplies the total connection count against your database server's limit.

This pool only exists in auth mode. In default mode the app uses localStorage and never touches a server-side database for its own state.

---

## User Database Connections (No Pooling)

The databases your users *query* (PostgreSQL, MySQL, SQL Server, SQLite) are handled by the adapter system in `lib/database/adapters/*`, not by the app DB pool above. These behave very differently.

Each adapter follows a **connect → query → disconnect** lifecycle per request. For example, the PostgreSQL adapter (`postgresql.adapter.ts`) creates a fresh `postgres(...)` client in `connect()` and tears it down in `disconnect()`:

```ts
async connect(config) {
  this.client = postgres({ host, port, database, username, password, ssl });
  await this.client`SELECT 1`;   // verify connectivity
  ...
}

async disconnect() {
  await this.client.end();
  this.client = null;
}
```

The flow in routes like `/api/query/execute`, `/api/connection/test`, and `/api/schema/start-introspection` is: create an adapter, `connect()`, run the work, `disconnect()`. The same pattern applies to MySQL, SQL Server, and SQLite adapters.

**Implications:**

- **There is no pooling for user databases.** Every query pays the full cost of opening a new connection (TCP + TLS handshake + auth + the adapter's `SELECT 1` connectivity check) and then closing it. For a remote database, this connection setup can dominate the latency of a fast query.
- **Introspection is sequential.** `BaseDatabaseAdapter.introspectSchema()` loops tables one at a time, issuing a columns query and a foreign-keys query per table. On a wide schema (many tables), introspection time scales with table count — which is exactly why it runs as a background task with progress polling (see below) rather than blocking a single request.
- **`testConnection()`** is deliberately a full connect + disconnect, so it measures real round-trip latency (`latencyMs`) — useful, but not free.
- **Read-only execution adds a small per-query cost.** `/api/query/execute` and `/api/schema/sample-data` set `AdapterConnectionConfig.readOnly = true`, and the adapters enforce it: PostgreSQL/MySQL run the statement inside a read-only transaction, SQL Server wraps it and always rolls back, and SQLite opens the connection read-only at connect time. For PostgreSQL, MySQL, and SQL Server this means an extra `BEGIN`/`ROLLBACK` round-trip on top of the connection setup above. Introspection deliberately stays writable (no transaction wrapper). Before execution, `validateReadOnlySql()` (`lib/database/sql-validator.ts`) parses the SQL with `node-sql-parser` to confirm it's a single SELECT — a cheap CPU step, with a heuristic fallback when the dialect grammar can't parse otherwise-valid SQL.

If you operate at a scale where per-query connection overhead to user databases becomes a bottleneck, that is the place to introduce pooling (e.g. a keyed pool per connection config). It is intentionally absent today to keep adapter lifecycles simple and stateless, which suits the current single-instance, interactive-query workload.

---

## Production Build (`output: 'standalone'`)

`next.config.mjs` sets:

```js
const nextConfig = {
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
}
```

- **`output: 'standalone'`** makes `next build` emit a self-contained server bundle (under `.next/standalone`) that includes only the runtime files needed to run the app, so it can be started with a plain Node process without a full `node_modules` install. This is what keeps the deployment model simple — copy the standalone output and run it. (This deployment simplicity is also why WebSockets are deferred — see below.)
- **`images: { unoptimized: true }`** disables the Next.js image optimization pipeline, avoiding the runtime image-processing cost (and the sharp dependency) at the expense of on-the-fly resizing.
- **`ignoreDuringBuilds` / `ignoreBuildErrors`** mean lint and type errors do **not** fail the production build. This trades build-time safety for build reliability; run `pnpm lint` and your editor's type checker separately rather than relying on the build to catch issues.

Standard production flow:

```bash
pnpm build    # produces the standalone output
pnpm start    # serves it
```

---

## OpenAI Cost & Rate Limiting

OpenAI usage is the most direct cost lever in the app. Every AI feature (query generation, enhancement, revision, follow-ups, descriptions, dashboard suggestions, chart generation) is a billable API call. Two mechanisms control this.

### `DEMO_RATE_LIMIT` (in-memory IP windows)

Implemented in `utils/rate-limiter.ts`:

- **Off by default.** When `DEMO_RATE_LIMIT` is empty/unset (or not a positive integer), `checkRateLimit()` returns `allowed: true` with `Infinity` — no limiting.
- **When set to a positive integer N**, each client IP gets N OpenAI-backed requests per **24-hour window** (`WINDOW_MS = 24 * 60 * 60 * 1000`). The window starts on the IP's first request and resets once it expires.
- **Storage is an in-memory `Map`** keyed by client IP. A `setInterval` runs `cleanupRateLimitStore()` every hour (`CLEANUP_INTERVAL_MS`) to evict expired entries and bound memory growth.
- **Client IP resolution** is proxy-aware (`getClientIP()`): it trusts Vercel's `x-vercel-forwarded-for` / Cloudflare's `cf-connecting-ip`, and `x-forwarded-for` / `x-real-ip` only from trusted proxies, falling back to a user-agent fingerprint. Configure trusted proxies via `TRUSTED_PROXIES` (see `lib/config/trusted-proxies.ts`).

Because the store is an in-memory `Map`, the counters are **per process and not shared across instances**, and they reset on restart/redeploy. This is sufficient for a single-instance demo deployment but is not a distributed rate limiter.

```bash
DEMO_RATE_LIMIT=10   # 10 OpenAI requests per IP per 24h
```

### BYOK — Bring Your Own Key

Users can bypass the demo rate limit entirely by supplying their own OpenAI key:

- The client manages the key via `hooks/use-openai-key.tsx` / `components/openai-api-provider.tsx`, storing it in **sessionStorage only** (never localStorage or the server). `fetchWithKey` injects it as the `x-user-openai-key` request header.
- Server-side, `getOpenAIKey(request)` prefers the user-supplied `x-user-openai-key` header and otherwise falls back to the server's `OPENAI_API_KEY`. `checkRateLimit()` calls `hasUserProvidedKey()` and **skips limiting** when a user key is present (the cost is now on the user's own OpenAI account).

**Tuning for cost control:**

- For public/demo deployments, set a conservative `DEMO_RATE_LIMIT` so the server key isn't drained, and rely on BYOK for power users.
- Choose `OPENAI_MODEL` deliberately — model selection is the single biggest per-request cost factor. The query-generation routes require `OPENAI_MODEL` (no fallback); other AI endpoints fall back to a default.
- Remember every "Generate SQL", "Enhance", "Revise", follow-up, suggestion, and chart-generation action is a separate billable call.

---

## Query, Result, and Chart Rendering Notes

These are high-level considerations rather than configuration knobs:

- **Result shaping happens server-side.** `BaseDatabaseAdapter.executeQuery()` normalizes every cell (dates → `YYYY-MM-DD` strings, numbers passed through, everything else stringified) and returns `{ columns, rows, rowCount, executionTime }`. The work scales with total cells (rows × columns), so very wide/tall result sets cost both server transform time and payload size. Prefer adding `LIMIT` in your queries for exploratory work.
- **Column-type detection is client-side and sampled.** `QueryResultsDisplay` infers column types from roughly the first 10 rows, so detection cost is bounded regardless of result height; rendering the full table, however, is not.
- **Charts use recharts (`recharts@2.15.0`), rendered on the client.** recharts is SVG-based, so render cost grows with the number of data points (and series). Large datasets piped straight into a chart can make the browser sluggish — aggregate/bucket data in the SQL query before charting rather than rendering thousands of raw points.
- **Query audit logging is off the hot path.** Every execution calls `logQuery()` (`lib/query-log.ts`), which is **fire-and-forget**: it never throws into the caller and its failure can't break query execution. When the app DB is enabled it inserts into the `query_log` table (migration `005_query_log.sql`, no FK); otherwise it appends a line to `logs/query-log.jsonl` (`lib/query-log-file.ts`). Credentials are never logged. The table/file grows one row per executed query, so for high-volume deployments plan periodic pruning/rotation of `query_log` / `query-log.jsonl`.

---

## Real-time Introspection Strategy (Polling vs WebSocket)

Schema introspection can be slow on large databases (it walks tables sequentially), so it runs as a **background task with client-side progress polling** rather than a single blocking request.

### Current mechanism

1. **Start** — the client `POST`s to `/api/schema/start-introspection`. The route resolves/validates the connection, generates a unique `processId` (`schema_<timestamp>_<random>`), seeds a status entry, kicks off `processSchemaInBackground(...)` **without awaiting it**, and immediately returns the `processId`.
2. **Background work** — `processSchemaInBackground` connects via the adapter, runs `introspectSchema()` with a progress callback, and writes status/progress updates into an in-memory map: `global.processStatus` (a `Map<processId, { status, progress, message, result?, error?, startTime }>`).
3. **Poll** — the client (`components/schema-explorer.tsx`) opens a `setInterval` that `GET`s `/api/schema/status?processId=...` **every 2000ms** (the interval is hardcoded). On `completed` it reads `result.schema` and stores it via `setSchema`; on `error` it surfaces the message. Either terminal state clears the interval.
4. **Cleanup** — the status route evicts `completed`/`error` entries older than 5 minutes (`startTime` check) so the map doesn't grow unbounded.

So today the "real-time" progress bar is plain HTTP polling against an in-memory status map — no persistent connection is held open.

### Why WebSockets are deferred (rationale)

Real push (WebSocket) was considered and intentionally **deferred**:

- **Next.js App Router has no native WebSocket route handlers.** Route handlers are request/response only; there is no first-class WS upgrade primitive in the App Router.
- **A real WebSocket would require a custom Node server** (to own the HTTP upgrade and socket lifecycle). That **breaks the simple `next start` / `output: 'standalone'` deployment model** this project relies on — you'd give up the self-contained standalone bundle and take on a bespoke server to maintain.
- **SSE (Server-Sent Events) is the lighter future option** if one-way push is ever needed, since progress is inherently server→client. It would avoid the full WebSocket machinery while still removing the poll loop. It is not implemented today.

Polling is framed here as an **intentional, adequate choice for the current deployment scale**: introspection is an occasional, user-initiated action, a 2-second cadence is plenty responsive for a progress bar, and the approach keeps the deployment a plain stateless Next.js app.

**Known limitation:** `global.processStatus` is an **in-memory, single-instance map**. It is not shared across processes, so if the app is scaled horizontally a poll can land on an instance that never ran (and has no record of) that `processId`. Introspection state also does not survive a restart. This is acceptable for the current single-instance model; any move to multi-instance would need a shared store (or the SSE/push redesign above) before introspection status could be trusted across instances.

---

## Related Documentation

- [Getting Started](./getting-started.md) — setup, environment variables, dev commands
- [Architecture Overview](../architecture/overview.md) — system design
- [Auth & Data Layer](../architecture/auth-and-data-layer.md) — app DB and storage providers
- [OpenAI Integration](./openai-integration.md) — AI feature details
- [Adding Database Support](./adding-database-support.md) — adapter system
