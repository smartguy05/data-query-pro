# Authentication Testing with Authentik

This guide walks through setting up a local Authentik instance to test the OIDC authentication flow in DataQuery Pro.

## Prerequisites

- **Container runtime**: [Podman](https://podman.io/) (with `podman-compose`) or [Docker](https://www.docker.com/) (with `docker compose`)
- **Python**: Required by the setup script for JSON parsing
- **curl**: Required by the setup script for API calls
- **Ports available**: 9000 (Authentik), 5432 (app DB), 5433 (demo DB)

## Quick Start

```bash
# 1. Start all containers (Authentik + app DB + demo DB)
podman-compose -f docker-compose.auth-test.yml up -d

# 2. Wait ~60s for Authentik to initialize, then run setup
bash scripts/setup-authentik.sh

# 3. Copy the output env vars into .env.local

# 4. Start the dev server
npm run dev
```

## What Gets Created

The `docker-compose.auth-test.yml` file starts **6 containers**:

| Service | Image | Port | Purpose |
|---|---|---|---|
| `authentik-server` | `ghcr.io/goauthentik/server:2024.12.3` | `localhost:9000` | Authentik identity provider |
| `authentik-worker` | `ghcr.io/goauthentik/server:2024.12.3` | (internal) | Background task processor |
| `authentik-db` | `postgres:15-alpine` | (internal) | Authentik's own database |
| `authentik-redis` | `redis:7-alpine` | (internal) | Authentik cache/sessions |
| `app-db` | `postgres:15-alpine` | `localhost:5432` | DataQuery Pro app database |
| `demo-db` | `postgres:15-alpine` | `localhost:5433` | Demo data for testing queries |

The `scripts/setup-authentik.sh` script configures Authentik via its API:

- **OAuth2/OIDC Provider** (`dataquery-pro`) with redirect URI pointing to `localhost:3000`
- **Application** (`DataQuery Pro`) linked to the provider
- **Admin group** (`dataquery-admins`) for admin role detection
- **Groups scope mapping** so group membership is included in OIDC tokens
- **Test users** (see below)

## Test Accounts

| Username | Password | Groups | Role in App |
|---|---|---|---|
| `testadmin` | `testadmin123` | `dataquery-admins` | Admin |
| `testuser` | `testuser123` | (none) | Regular user |
| `akadmin` | `admin` | (Authentik superuser) | Authentik admin only |

## Environment Variables

After running the setup script, copy the output into your `.env.local`:

```env
# Authentication (Authentik OIDC)
AUTH_OIDC_ISSUER=http://localhost:9000/application/o/dataquery-pro/
AUTH_OIDC_CLIENT_ID=dataquery-pro
AUTH_OIDC_CLIENT_SECRET=dataquery-pro-test-secret
AUTH_SECRET=<generated-by-script>
AUTH_ADMIN_GROUP=dataquery-admins
AUTH_URL=http://localhost:3000

# App Database
APP_DATABASE_URL=postgres://dataquery:dataquery@localhost:5432/dataquery_app

# Encryption key for stored connection passwords
APP_ENCRYPTION_KEY=<generated-by-script>
```

The setup script generates fresh `AUTH_SECRET` and `APP_ENCRYPTION_KEY` values each time it runs. You only need to set these once.

## Authentik Admin UI

Access the Authentik admin panel at **http://localhost:9000/if/admin/** to:

- Manage users and groups
- Inspect the OAuth2 provider configuration
- View login events and audit logs
- Modify authorization flows

Login: `akadmin` / `admin`

## Container Lifecycle

```bash
# Start containers
podman-compose -f docker-compose.auth-test.yml up -d

# View logs
podman-compose -f docker-compose.auth-test.yml logs -f authentik-server

# Stop containers (preserves data)
podman-compose -f docker-compose.auth-test.yml down

# Stop and delete all data (fresh start)
podman-compose -f docker-compose.auth-test.yml down -v

# Restart just Authentik server
podman-compose -f docker-compose.auth-test.yml restart authentik-server
```

Replace `podman-compose` with `docker compose` if using Docker.

## Testing Scenarios

### Admin Login Flow
1. Navigate to `http://localhost:3000`
2. Click "Sign in with Authentik"
3. Log in as `testadmin` / `testadmin123`
4. Approve the consent screen (first login only)
5. Verify you're redirected back and have admin privileges

### Regular User Login Flow
1. Same steps but log in as `testuser` / `testuser123`
2. Verify you do NOT have admin privileges

### Data Migration (localStorage to DB)
1. Before enabling auth, create some connections/reports in localStorage mode
2. Enable auth and log in
3. The app should show a migration dialog offering to import localStorage data

### Session Expiry
- JWT tokens are short-lived; test that expired sessions redirect to login
- The Authentik consent is remembered after first approval

## Troubleshooting

### Setup script fails with "Authentik did not become ready"
Authentik takes 60-90 seconds to fully initialize on first start. Wait and try again:
```bash
# Check if Authentik is responding
curl -s http://localhost:9000/api/v3/root/config/ | head -c 100

# Check container logs for errors
podman logs dashboard_authentik-server_1 --tail 20
```

### "Configuration" error on sign-in
Ensure `AUTH_URL=http://localhost:3000` is set in `.env.local`. Auth.js v5 requires this to construct callback URLs correctly. Restart the dev server after changing env vars.

### Port 5432 already in use
If you have a local PostgreSQL running, stop it first or change the port mapping in `docker-compose.auth-test.yml`:
```yaml
app-db:
  ports:
    - "5434:5432"  # Use a different host port
```
Then update `APP_DATABASE_URL` accordingly.

### OIDC discovery fails
Verify the issuer URL is reachable from the Next.js server:
```bash
curl http://localhost:9000/application/o/dataquery-pro/.well-known/openid-configuration
```
This should return a JSON document with `authorization_endpoint`, `token_endpoint`, etc.

### Groups not appearing in token
Check that the "Groups Scope" mapping exists in Authentik and is attached to the provider. You can verify in the Authentik admin UI under **Applications > Providers > DataQuery Pro OIDC > Scope Mappings**.

### Fresh start
To completely reset the test environment:
```bash
podman-compose -f docker-compose.auth-test.yml down -v
podman-compose -f docker-compose.auth-test.yml up -d
# Wait ~60s
bash scripts/setup-authentik.sh
```

## Architecture Notes

When auth is enabled (`AUTH_OIDC_*` env vars set):

1. **Middleware** (`middleware.ts`) checks for a JWT token on every request; unauthenticated users are redirected to `/auth/login`
2. **Login page** (`app/auth/login/page.tsx`) shows a "Sign in with Authentik" button that calls `signIn("authentik")` from `next-auth/react`
3. **Auth.js route** (`app/api/auth/[...nextauth]/route.ts`) handles the OIDC flow: redirect to Authentik, receive callback with auth code, exchange for tokens
4. **JWT callback** extracts groups from the OIDC profile, checks admin membership, and upserts the user in the app database
5. **Storage switches** from `LocalStorageProvider` to `ApiStorageProvider`, which calls `/api/data/*` CRUD routes backed by PostgreSQL
