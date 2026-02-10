# Getting Started

Guide to setting up and running DataQuery Pro locally.

## Prerequisites

- Node.js 18+
- **pnpm** (package manager) — install with `npm install -g pnpm`
- A supported database (PostgreSQL, MySQL, SQL Server, or SQLite)
- OpenAI API key (for AI features)

## Installation

### Option 1: Docker (Recommended)

The fastest way to get started is with Docker:

1. **Clone the repository:**
```bash
git clone <repository-url>
cd dashboard
```

2. **Create environment file:**
```bash
cp .env.example .env.local
```

3. **Configure environment variables:**
```bash
# .env.local
OPENAI_API_KEY=sk-...    # Your OpenAI API key
```

4. **Start with Docker Compose:**
```bash
docker-compose up
```

5. **Open browser:**
Navigate to `http://localhost:3000`

### Option 2: Local Development

1. **Clone the repository:**
```bash
git clone <repository-url>
cd dashboard
```

2. **Install dependencies:**
```bash
pnpm install
```

3. **Create environment file:**
```bash
cp .env.example .env.local
```

4. **Configure environment variables:**
```bash
# .env.local
OPENAI_API_KEY=sk-...    # Your OpenAI API key
OPENAI_MODEL=gpt-5       # Model to use (optional)
```

5. **Start development server:**
```bash
pnpm dev
```

6. **Open browser:**
Navigate to `http://localhost:3000`

## Initial Setup Flow

### Step 1: Create Database Connection

1. Go to **Database** page (`/database`)
2. Click **Add Connection**
3. Fill in connection details:
   - Name: Display name for the connection
   - Type: PostgreSQL, MySQL, SQL Server, or SQLite
   - Host: Database hostname (not needed for SQLite)
   - Port: Database port (varies by type)
   - Database: Database name (or file path for SQLite)
   - Username: Database user
   - Password: Database password
   - Description: (Optional) Business context
4. Click **Save**

### Step 2: Introspect Schema

1. Go to **Schema** page (`/schema`)
2. Click **Introspect Schema**
3. Wait for schema to load
4. Review tables and columns

### Step 3: Generate AI Descriptions (Optional)

1. On Schema page, click **Generate AI Descriptions**
2. Wait for AI to process each table/column
3. Edit descriptions as needed

### Step 4: Upload Schema to OpenAI

1. Go to **Database** page
2. Find your connection
3. Click **Upload Schema File**
4. Wait for upload confirmation

This creates a vector store for query context.

### Step 5: Query Your Database

1. Go to **Query** page (`/query`)
2. Enter natural language query (e.g., "Show all customers")
3. Click **Generate SQL**
4. Review generated SQL
5. Click **Execute**
6. View results

## Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint
```

## Project Structure

```
app/                  # Next.js App Router pages
├── api/             # API routes
├── database/        # Database management page
├── schema/          # Schema explorer page
├── query/           # Query interface page
└── reports/         # Reports management page

components/          # React components
├── ui/              # shadcn/ui (don't modify)
└── [features]       # Feature components

lib/                 # Core utilities
└── database-connection-options.tsx

models/              # TypeScript interfaces
utils/               # Utility functions
hooks/               # Custom React hooks
```

## Configuration Files

| File | Purpose |
|------|---------|
| `.env.local` | Environment variables |
| `tsconfig.json` | TypeScript configuration |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `components.json` | shadcn/ui configuration |
| `next.config.mjs` | Next.js configuration |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI features |
| `OPENAI_MODEL` | No | Model name (defaults to gpt-5) |
| `DEMO_RATE_LIMIT` | No | API requests per IP per 24h (empty = unlimited) |
| `AUTH_OIDC_ISSUER` | For auth | OIDC issuer URL (enables auth mode) |
| `AUTH_OIDC_CLIENT_ID` | For auth | OIDC client ID |
| `AUTH_OIDC_CLIENT_SECRET` | For auth | OIDC client secret |
| `AUTH_SECRET` | For auth | JWT signing key (`openssl rand -hex 32`) |
| `AUTH_URL` | For auth | App URL, e.g. `http://localhost:3000` |
| `AUTH_ADMIN_GROUP` | For auth | Authentik group name for admin access |
| `APP_DATABASE_URL` | For auth | PostgreSQL connection string for app data |
| `APP_ENCRYPTION_KEY` | For auth | 64-char hex key for encrypting passwords |

### Rate Limiting (Optional)

For demo deployments, set `DEMO_RATE_LIMIT` to limit OpenAI API usage:

```bash
DEMO_RATE_LIMIT=10  # 10 requests per IP per 24 hours
```

Users can bypass rate limits by providing their own OpenAI API key via the settings dialog in the navigation bar.

## Auth Mode (Multi-User with Authentik)

The steps above run the app in **default mode** (localStorage, no auth). To test with OIDC authentication, admin panel, and PostgreSQL-backed storage, see the [Authentication Testing guide](./authentication-testing.md).

Quick summary:

```bash
# 1. Start Authentik + app DB + demo DB
docker compose -f docker-compose.auth-test.yml up -d

# 2. Wait ~60s, then configure Authentik
bash scripts/setup-authentik.sh

# 3. Copy the output env vars into .env.local (alongside OPENAI_API_KEY)

# 4. Start the dev server
pnpm dev
```

Test accounts: `testadmin` / `testadmin123` (admin) and `testuser` / `testuser123` (regular user).

## Demo Database

A demo PostgreSQL database with sample CloudMetrics data is available. If you're using `docker-compose.auth-test.yml`, it's already included on port 5433. Otherwise:

```bash
docker run -d --name demo-postgres -e POSTGRES_USER=demo -e POSTGRES_PASSWORD=demo \
  -e POSTGRES_DB=cloudmetrics -p 5433:5432 postgres:15
docker exec -i demo-postgres psql -U demo -d cloudmetrics < scripts/demo-database.sql
```

Connection details: host `localhost`, port `5433`, database `cloudmetrics`, user `demo`, password `demo`.

## Common Issues

### "Query is required" error
- Ensure you've entered a query before clicking Generate

### "Vector store not found"
- Schema needs to be uploaded to OpenAI
- Go to Database page and click "Upload Schema File"

### Connection fails
- Verify database credentials
- Check if database allows external connections
- Verify port is correct and open

### AI descriptions not generating
- Check `OPENAI_API_KEY` is set correctly
- Verify API key has sufficient credits
- Check console for rate limit errors

### Schema not loading
- Verify connection credentials
- Check database has tables in `public` schema
- Check database user has SELECT permissions

## Development Tips

### Adding shadcn/ui Components

```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
```

### TypeScript Path Aliases

Use `@/` for imports from project root:
```typescript
import { useDatabaseOptions } from '@/lib/database-connection-options';
import { Button } from '@/components/ui/button';
```

### Using the Database Context

```typescript
import { useDatabaseOptions } from '@/lib/database-connection-options';

function MyComponent() {
  const {
    currentConnection,
    currentSchema,
    connections,
    setCurrentConnection
  } = useDatabaseOptions();

  // Use context values
}
```

---

## Related Documentation
- [Architecture Overview](../architecture/overview.md) - System design
- [Authentication Testing](./authentication-testing.md) - Local Authentik setup for auth mode
- [Adding Database Support](./adding-database-support.md) - New DB types
- [OpenAI Integration](./openai-integration.md) - AI features
