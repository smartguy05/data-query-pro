# Deployment (Docker Self-Host)

Guide to deploying DataQuery Pro on your own infrastructure with Docker. This
covers the provided Compose files, the production environment variables, how
database migrations run, reverse-proxy configuration, and the single-instance
caveats to be aware of before scaling horizontally.

For local development setup, see [Getting Started](./getting-started.md). For
local OIDC auth testing, see [Authentication Testing](./authentication-testing.md).

## Container Image

The repository ships a multi-stage [`Dockerfile`](../../Dockerfile) that builds
a Next.js **standalone** output:

- **Base** — `node:20-alpine` with `libc6-compat`, `python3`, `make`, `g++`
  (needed to compile native database driver modules).
- **deps** — runs `npm ci` against `package.json` / `package-lock.json`.
- **builder** — copies the source, sets `NODE_ENV=production` and
  `NEXT_TELEMETRY_DISABLED=1`, and runs `npm run build`.
- **runner** — copies the standalone server, `public/`, `.next/static`, and
  **`lib/db/migrations`** (these `.sql` files are read at runtime — see
  [Database Migrations](#database-migrations) below). Runs as a non-root
  `nextjs` user, exposes port **3000**, and starts with `node server.js`.

The runner defaults to `PORT=3000` and `HOSTNAME=0.0.0.0`.

> **Note:** [`.dockerignore`](../../.dockerignore) excludes `.env*`, `docs`,
> `.next`, `node_modules`, `.memories`, the Compose files, and (most) markdown.
> Environment files are intentionally **not** baked into the image — provide
> them at runtime (see below).

## `docker-compose.yml` — Production-style Self-Host

The root [`docker-compose.yml`](../../docker-compose.yml) defines two services
plus a named volume:

### `app`
- **Build:** from the local `Dockerfile` (`context: .`).
- **Ports:** `3000:3000` — the app is reachable on host port 3000.
- **Volumes:** `./config:/app/config:ro` — mounts your `config/` directory
  read-only so file-based server connections (`config/databases.json`) and
  shared reports (`config/reports.json`) are picked up. See
  [`config/README.md`](../../config/README.md).
- **`depends_on`:** waits for `app-db` to pass its healthcheck before starting.
- **`restart: unless-stopped`.**
- **Environment** (all sourced from the host shell / a root `.env` file, with
  defaults applied via `${VAR:-default}`):

  | Variable | Default in Compose |
  |----------|--------------------|
  | `OPENAI_API_KEY` | (passed through, no default) |
  | `OPENAI_MODEL` | `gpt-4o` |
  | `DEMO_RATE_LIMIT` | empty (disabled) |
  | `TRUSTED_PROXIES` | empty |
  | `AUTH_OIDC_ISSUER` | empty (auth disabled) |
  | `AUTH_OIDC_CLIENT_ID` | empty |
  | `AUTH_OIDC_CLIENT_SECRET` | empty |
  | `AUTH_SECRET` | empty |
  | `AUTH_ADMIN_GROUP` | `dataquery-admins` |
  | `APP_DATABASE_URL` | `postgres://${APP_DB_USER:-dataquery}:${APP_DB_PASSWORD:-dataquery}@app-db:5432/${APP_DB_NAME:-dataquery_app}` |
  | `APP_ENCRYPTION_KEY` | empty |

  Note that `APP_DATABASE_URL` is assembled from `APP_DB_USER`, `APP_DB_PASSWORD`,
  and `APP_DB_NAME` and points at the `app-db` service hostname. There is no
  `AUTH_URL` line in this file — set it yourself (in your `.env` or by adding
  the line) when enabling auth, since Auth.js v5 requires it.

### `app-db`
- **Image:** `postgres:15-alpine`.
- **Environment:** `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
  default to `dataquery` / `dataquery` / `dataquery_app`.
- **Volume:** `app_db_data:/var/lib/postgresql/data` (named volume, persists
  app data across restarts).
- **Healthcheck:** `pg_isready` every 5s (timeout 3s, 5 retries).
- **No host port is published** — only the `app` service reaches it over the
  Compose network.

A commented-out `demo-db` service (and `demo_db_data` volume) is included as a
template if you want a sample CloudMetrics database alongside the app.

### Quick start

```bash
# Minimal (default/localStorage mode — only OpenAI is required)
OPENAI_API_KEY=sk-... docker compose up -d
```

The `app-db` Postgres service still starts in this configuration, but the app
only uses it when auth mode is enabled (see [Deployment Modes](#deployment-modes)).

## `docker-compose.auth-test.yml` — Auth / OIDC Test Stack

[`docker-compose.auth-test.yml`](../../docker-compose.auth-test.yml) is a
**test/dev** stack for exercising OIDC auth locally. It does **not** build or
run the app container itself — you run the app separately (e.g. `pnpm dev`) and
point it at these services. It defines:

- **`authentik-db`** — `postgres:15-alpine` for Authentik (user `authentik`).
- **`authentik-redis`** — `redis:7-alpine`, used by Authentik.
- **`authentik-server`** — `ghcr.io/goauthentik/server:2024.12.3` (`command: server`),
  published on host port **9000**. Bootstraps an admin via
  `AUTHENTIK_BOOTSTRAP_PASSWORD` / `AUTHENTIK_BOOTSTRAP_TOKEN` /
  `AUTHENTIK_BOOTSTRAP_EMAIL`. The secret key here is a hard-coded test value —
  **not for production.**
- **`authentik-worker`** — same image with `command: worker`.
- **`app-db`** — `postgres:15-alpine` (`dataquery`/`dataquery`/`dataquery_app`),
  published on host port **5432** for the locally-run app to connect to.
- **`demo-db`** — `postgres:15-alpine` (`demo`/`demo`/`cloudmetrics`) on host
  port **5433**, seeded from `./scripts/demo-database.sql` via the Postgres
  init-dir mount. A ready-made target database for testing queries.

Named volumes: `authentik_db_data`, `app_db_data`, `demo_db_data`.

This file is the basis for the [Authentication Testing guide](./authentication-testing.md),
which walks through running `scripts/setup-authentik.sh` to produce the
`AUTH_OIDC_*` env values. Treat it as a local-testing harness, not a production
auth deployment.

## Production Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | **Always** | OpenAI API key for all AI features (query generation, descriptions, suggestions, charts). |
| `OPENAI_MODEL` | For query gen | Model used for SQL generation. **Required (no fallback) by `/api/query/generate`, `/enhance`, `/revise`**; other AI endpoints fall back to a default. Compose defaults it to `gpt-4o`. |
| `DEMO_RATE_LIMIT` | No | Integer — OpenAI requests per IP per 24h. Empty/unset = unlimited. See [single-instance caveat](#single-instance-caveats). |
| `TRUSTED_PROXIES` | No (recommended behind a proxy) | Comma-separated proxy IPs whose forwarded headers are trusted. See [Reverse Proxy](#reverse-proxy--trusted_proxies). |
| `AUTH_OIDC_ISSUER` | **Auth mode only** | OIDC issuer URL. Setting the three `AUTH_OIDC_*` vars enables auth mode. |
| `AUTH_OIDC_CLIENT_ID` | **Auth mode only** | OIDC client ID. |
| `AUTH_OIDC_CLIENT_SECRET` | **Auth mode only** | OIDC client secret. |
| `AUTH_SECRET` | **Auth mode only** | JWT signing key. Generate with `openssl rand -hex 32`. |
| `AUTH_URL` | **Auth mode only** | Public app URL, e.g. `https://dataquery.example.com`. Required by Auth.js v5. Not present in `docker-compose.yml` by default — add it. |
| `AUTH_ADMIN_GROUP` | Auth mode (optional) | Authentik group that grants admin access. Compose defaults to `dataquery-admins`. |
| `APP_DATABASE_URL` | **Auth mode only** | PostgreSQL connection string for app data. Compose builds it pointing at the `app-db` service. |
| `APP_ENCRYPTION_KEY` | **Auth mode only** | 64-char hex key (`openssl rand -hex 32`) used for AES-256-GCM encryption of stored database passwords. |

**Auth-mode-only group:** `AUTH_OIDC_ISSUER`, `AUTH_OIDC_CLIENT_ID`,
`AUTH_OIDC_CLIENT_SECRET`, `AUTH_SECRET`, `AUTH_URL`, `APP_DATABASE_URL`, and
`APP_ENCRYPTION_KEY` are only needed when running with authentication. In
default (localStorage) mode you only need `OPENAI_API_KEY` (and optionally
`OPENAI_MODEL`).

## Database Migrations

Migrations run **automatically on startup** — there is no separate migration
step to invoke.

- The Next.js startup hook [`instrumentation.ts`](../../instrumentation.ts) runs
  `register()` and, **only when `NEXT_RUNTIME === 'nodejs'` and
  `APP_DATABASE_URL` is set**, imports and calls `runMigrations()`.
- [`lib/db/migrate.ts`](../../lib/db/migrate.ts) creates a `schema_migrations`
  tracking table, reads every `*.sql` file from `lib/db/migrations/` (sorted by
  name), skips already-applied files, and applies the rest — each inside a
  transaction that also records the filename. Migrations are idempotent across
  restarts.
- Current migration files: `001_initial_schema.sql`,
  `002_server_connections.sql`, `003_cascade_connection_deletes.sql`,
  `004_query_accuracy.sql`.
- Because the migration `.sql` files are read from disk at runtime, the
  `Dockerfile` explicitly copies `lib/db/migrations` into the runner image.

If `APP_DATABASE_URL` is unset (default/localStorage mode), migrations are
skipped entirely and no app database is touched.

## Reverse Proxy / `TRUSTED_PROXIES`

When the app sits behind a reverse proxy (nginx, Traefik, Caddy, a load
balancer, etc.), the direct connection IP is the proxy, not the real client.
Client IP detection is implemented in [`utils/rate-limiter.ts`](../../utils/rate-limiter.ts):

- `x-forwarded-for` / `x-real-ip` headers are **only trusted when the direct
  connection comes from an IP listed in `TRUSTED_PROXIES`** (see
  `lib/config/trusted-proxies.ts`). This prevents clients from spoofing their IP
  to evade rate limits.
- On Vercel and Cloudflare, the platform's verified headers
  (`x-vercel-forwarded-for` / `cf-connecting-ip`) are used automatically.
- If the proxy IP is not trusted, the proxy's own IP is used as the client
  identity — which would make rate limiting bucket all traffic together.

**Set `TRUSTED_PROXIES`** to your proxy's IP(s) (comma-separated) so the correct
client IP is resolved. This matters whenever you rely on `DEMO_RATE_LIMIT`.

Make sure your proxy forwards the `Host` header and (for auth mode) terminates
TLS at the public `AUTH_URL`, and forwards `X-Forwarded-For` / `X-Real-IP`.

## Single-Instance Caveats

Two pieces of state are held **in process memory and are not shared across
instances**. Running more than one app container/replica will behave
incorrectly for these features:

1. **Rate limiter** — `utils/rate-limiter.ts` stores per-IP request counts in an
   in-memory `Map` (`rateLimitStore`), cleaned up by a `setInterval`. With N
   instances, a user effectively gets up to N× the configured `DEMO_RATE_LIMIT`
   because each instance counts independently.
2. **Schema introspection status** — the background introspection process tracks
   progress in a `global.processStatus` `Map`
   (`app/api/schema/start-introspection/route.ts`), polled by
   `app/api/schema/status/route.ts`. If the start request and the status poll
   land on different instances, the poller won't find the job.

For these reasons, **deploy a single app instance** unless/until this state is
externalized (e.g. to Redis/Postgres). If you must run multiple replicas, pin
introspection-related traffic with sticky sessions and accept that
`DEMO_RATE_LIMIT` is enforced per-instance.

## Deployment Modes

DataQuery Pro deploys in two distinct shapes (see also the
[dual-mode summary in the docs index](../README.md#dual-mode-architecture)):

| | **Default (localStorage)** | **Auth (PostgreSQL)** |
|--|----------------------------|------------------------|
| Storage | Browser localStorage (per device) | App PostgreSQL via `/api/data/*` |
| Auth | None | Authentik OIDC (Auth.js v5) |
| Required env | `OPENAI_API_KEY` | `OPENAI_API_KEY` + all auth-mode vars |
| App DB | Not used (migrations skipped) | Required; migrations run on startup |
| Encryption | n/a (passwords in localStorage) | `APP_ENCRYPTION_KEY` (AES-256-GCM) |
| Multi-user | No | Yes (sharing, admin panel, server connections) |

- **Default mode** is the simplest deploy: one `app` container, an `OPENAI_API_KEY`,
  and no app database dependency. All user data lives in each browser.
- **Auth mode** adds the PostgreSQL `app-db`, OIDC config, and encryption key.
  Credentials are resolved server-side and stored encrypted in the app DB.

---

## Related Documentation
- [Getting Started](./getting-started.md) - Local setup and first-run flow
- [Authentication Testing](./authentication-testing.md) - Local Authentik/OIDC stack
- [Performance](./performance.md) - Tuning and scaling considerations
- [Auth & Data Layer](../architecture/auth-and-data-layer.md) - App DB, repositories, encryption
- [Server Config](../../config/README.md) - File-based connections and shared reports
