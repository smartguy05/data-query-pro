# DataQuery Pro

AI-powered database visualization and query tool that lets you query your PostgreSQL databases using natural language.

## Features

- **Natural Language Queries** - Convert plain English to SQL using OpenAI
- **Schema Introspection** - Automatically discover database structure
- **AI Descriptions** - Generate business-focused descriptions for tables and columns
- **Query Results Visualization** - View data as tables or charts
- **Saved Reports** - Save and parameterize queries for reuse
- **AI Suggestions** - Get smart metric and report recommendations
- **Multi-User Support** - Optional Azure SSO authentication with role-based access
- **Admin Dashboard** - Manage users, connections, and permissions
- **Report Sharing** - Share reports with team members

## Quick Start

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Add your OpenAI API key to .env.local
# OPENAI_API_KEY=sk-...

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Setup Flow

1. **Create Connection** - Add your PostgreSQL database credentials
2. **Introspect Schema** - Discover tables and columns
3. **Generate Descriptions** - Let AI describe your data (optional)
4. **Upload Schema** - Upload to OpenAI for query context
5. **Start Querying** - Use natural language to query your data

## Documentation

Comprehensive developer documentation is available in the [docs](./docs) folder:

- [Documentation Index](./docs/README.md) - Start here
- [Architecture Overview](./docs/architecture/overview.md) - System design
- [API Reference](./docs/api/overview.md) - All endpoints
- [Component Guide](./docs/components/overview.md) - React components
- [Data Models](./docs/models/overview.md) - TypeScript interfaces
- [Developer Guides](./docs/guides/getting-started.md) - How-to guides

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, shadcn/ui, Tailwind CSS |
| State | React Context + localStorage/PostgreSQL |
| Database | PostgreSQL |
| AI | OpenAI API (Responses API) |
| Charts | Recharts |
| Auth | NextAuth.js + Azure AD (optional) |

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run linter
```

## Environment Variables

### Required
```bash
OPENAI_API_KEY=sk-...    # Required for AI features
OPENAI_MODEL=gpt-5      # Model for query generation (optional)
```

### Multi-User Mode (Optional)
```bash
# Enable multi-user mode
MULTI_USER_ENABLED=true
NEXT_PUBLIC_MULTI_USER_ENABLED=true

# PostgreSQL (for storing users, connections, permissions)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=dataquery_pro
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=your_password
ENCRYPTION_KEY=your_32_byte_hex_key  # For password encryption

# Azure AD SSO
AZURE_AD_CLIENT_ID=your_client_id
AZURE_AD_CLIENT_SECRET=your_client_secret
AZURE_AD_TENANT_ID=your_tenant_id
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_secret
```

## Roadmap

- [ ] Support additional database types (MySQL, SQLite, MSSQL)
- [ ] Enhanced chart creation and customization
- [ ] Report scheduling
- [x] Team collaboration features (multi-user support)

## License

MIT