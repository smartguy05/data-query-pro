# Getting Started

Guide to setting up and running DataQuery Pro locally.

## Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (for connecting)
- OpenAI API key (for AI features)

## Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd dashboard
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create environment file:**
```bash
cp .env.example .env.local
```

4. **Configure environment variables:**
```bash
# .env.local
OPENAI_API_KEY=sk-...    # Your OpenAI API key
OPENAI_MODEL=gpt-4o      # Model to use (gpt-4o, gpt-4-turbo, etc.)
```

5. **Start development server:**
```bash
npm run dev
```

6. **Open browser:**
Navigate to `http://localhost:3000`

## Initial Setup Flow

### Step 1: Create Database Connection

1. Go to **Database** page (`/database`)
2. Click **Add Connection**
3. Fill in connection details:
   - Name: Display name for the connection
   - Type: PostgreSQL (only working option)
   - Host: Database hostname
   - Port: Database port (default 5432)
   - Database: Database name
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
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
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
| `OPENAI_MODEL` | No | Model name (defaults to gpt-4o) |

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
- [Adding Database Support](./adding-database-support.md) - New DB types
- [OpenAI Integration](./openai-integration.md) - AI features
