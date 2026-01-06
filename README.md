# DataQuery Pro

![Dashboard](screenshots/14-dashboard-complete.png)

> AI-powered database visualization and query tool - ask questions about your data in plain English

DataQuery Pro lets you connect to **PostgreSQL, MySQL, SQL Server, and SQLite** databases, explore schemas with AI-generated descriptions, and query your data using natural language that automatically converts to SQL with dialect-specific syntax.

## Features

- **Multi-Database Support** - Connect to PostgreSQL, MySQL, SQL Server, or SQLite databases
- **Natural Language Queries** - Convert plain English questions to SQL using OpenAI
- **Query Enhancement** - Let AI improve your vague queries with specific details from your schema
- **Self-Correcting Queries** - When queries fail, AI automatically revises them to fix errors
- **Schema Introspection** - Automatically discover database structure, tables, and relationships
- **AI Descriptions** - Generate business-focused descriptions for tables and columns
- **Query Results Visualization** - View data as tables or various chart types
- **Saved Reports** - Save queries as parameterized reports for reuse
- **AI Suggestions** - Get smart metric and report recommendations based on your schema
- **Follow-Up Questions** - Ask follow-up questions about your query results to drill deeper
- **Dark/Light Mode** - Full theme support for comfortable viewing

---

## Screenshots

### Dashboard

The dashboard provides an overview of your connected database, saved reports, and AI-generated suggestions for metrics you might find valuable.

![Dashboard Welcome](screenshots/01-dashboard-welcome.png)
*Initial dashboard before connecting a database*

![Dashboard Complete](screenshots/14-dashboard-complete.png)
*Dashboard with active connection, reports, and AI suggestions*

<details>
<summary>Light Mode</summary>

![Dashboard Light Mode](screenshots/15-dashboard-light.png)

</details>

---

### Database Connection

Add your database credentials to get started. DataQuery Pro supports PostgreSQL, MySQL, SQL Server, and SQLite. The connection card shows status, table count, and schema upload state.

![Database Form](screenshots/02-database-form.png)
*Enter your database connection details*

![Database Connected](screenshots/03-database-connected.png)
*Connection established with schema uploaded indicator*

---

### Schema Explorer

Browse your database structure with AI-generated descriptions that explain each table's business purpose.

![Schema Overview](screenshots/04-schema-overview.png)
*View all tables in your database*

![Schema Expanded](screenshots/05-schema-expanded.png)
*Expand tables to see columns, types, and constraints*

<details>
<summary>Light Mode</summary>

![Schema Light Mode](screenshots/16-schema-light.png)

</details>

---

### AI-Generated Descriptions

Click "Generate AI Descriptions" to automatically create business-focused descriptions for every table and column in your schema. These descriptions help the AI understand your data better, resulting in more accurate query generation.

![AI Table Descriptions](screenshots/23-schema-ai-descriptions.png)
*Tables with AI-generated descriptions explaining their business purpose*

![AI Column Descriptions](screenshots/24-schema-column-descriptions.png)
*Expanded table showing column-level AI descriptions with data types and constraints*

---

### Natural Language Queries

Ask questions about your data in plain English. DataQuery Pro converts your question to SQL, shows the confidence level, and provides an explanation.

![Query Empty](screenshots/07-query-empty.png)
*The query interface*

![Query Entered](screenshots/08-query-entered.png)
*Enter your question in natural language*

![Query Generated](screenshots/09-query-generated.png)
*AI generates SQL with confidence score and explanation*

---

### Enhance Query with AI

Not sure how to phrase your question? Type a simple query and click "Enhance Query with AI" to let the AI expand it with specific tables, columns, and business logic from your schema.

![Query Enhanced](screenshots/18-query-enhanced.png)
*A simple "show revenue by month" query enhanced with detailed instructions about which tables, columns, and aggregations to use*

---

### Self-Correcting Queries

When a query fails due to errors (like referencing a non-existent table), click "Revise Query" to let the AI automatically fix the problem. The AI analyzes the error, searches your schema for alternatives, and generates a corrected query.

![Query Error](screenshots/21-query-error-revise.png)
*Query failed with table not found error - click "Revise Query" to fix*

![Query Revised](screenshots/22-query-revised.png)
*AI automatically corrected the query, using the correct table from the schema*

---

### Query Results

View your results as a sortable, searchable table or visualize them as charts.

![Results Table](screenshots/10-query-results-table.png)
*Table view with search and export options*

![Results Chart](screenshots/11-query-results-chart.png)
*Automatic chart generation from your data*

<details>
<summary>Light Mode</summary>

![Query Light Mode](screenshots/17-query-results-light.png)

</details>

---

### Follow-Up Questions

After viewing results, ask follow-up questions to drill deeper into your data. The AI generates new queries based on your original results and question.

![Follow-up Dialog](screenshots/19-followup-dialog.png)
*Ask a follow-up question about your results*

![Follow-up Result](screenshots/20-followup-result.png)
*AI generates a new query based on your follow-up question, shown in a separate tab*

---

### Saved Reports

Save frequently used queries as reports for quick access. Reports can include parameters for flexible reuse.

![Save Report Dialog](screenshots/12-save-report-dialog.png)
*Save queries as named reports with descriptions*

![Reports List](screenshots/13-reports-list.png)
*Manage and run your saved reports*

---

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd dashboard

# Create environment file
cp .env.example .env.local
# Add your OpenAI API key to .env.local

# Start with Docker Compose
docker-compose up
```

### Option 2: Local Development

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

---

## Setup Flow

1. **Create Connection** - Add your database credentials on the Database page (PostgreSQL, MySQL, SQL Server, or SQLite)
2. **Introspect Schema** - Click "Introspect" to discover tables and columns
3. **Generate Descriptions** - Let AI describe your data for better query understanding (optional but recommended)
4. **Upload Schema** - Click "Upload Schema File" to enable natural language queries
5. **Start Querying** - Go to the Query page and ask questions in plain English

### Server Configuration (Optional)

For team deployments, you can provide pre-configured database connections via a server-side config file:

1. Copy `config/databases.json.example` to `config/databases.json`
2. Update with your shared database credentials
3. Deploy the config file with your application
4. All users will automatically see these connections marked as "Server Config"
5. Server connections cannot be edited/deleted through the UI

See [config/README.md](./config/README.md) for detailed setup instructions.

---

## Demo Database

To try DataQuery Pro with sample data, demo database scripts are provided for all supported database types in the `scripts/` folder:

### PostgreSQL

```bash
# Start PostgreSQL container
docker run -d \
  --name cloudmetrics-db \
  -e POSTGRES_USER=demo \
  -e POSTGRES_PASSWORD=demo123 \
  -e POSTGRES_DB=cloudmetrics \
  -p 5433:5432 \
  postgres:15

# Load demo data
docker exec -i cloudmetrics-db psql -U demo -d cloudmetrics < scripts/demo-database.sql

# Connection: localhost:5433, database: cloudmetrics, user: demo, password: demo123
```

### MySQL

```bash
# Start MySQL container
docker run -d \
  --name dataquery-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=demo \
  -e MYSQL_USER=demo \
  -e MYSQL_PASSWORD=password \
  -p 3306:3306 \
  mysql:8

# Load demo data
docker exec -i dataquery-mysql mysql -udemo -ppassword demo < scripts/demo-database-mysql.sql

# Connection: localhost:3306, database: demo, user: demo, password: password
```

### SQL Server

```bash
# Start SQL Server container
docker run -d \
  --name dataquery-sqlserver \
  -e ACCEPT_EULA=Y \
  -e SA_PASSWORD=Strong@Password1 \
  -p 1433:1433 \
  mcr.microsoft.com/mssql/server:2022-latest

# Create database and load demo data
docker exec -i dataquery-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Strong@Password1' -C \
  -Q "CREATE DATABASE demo"
docker exec -i dataquery-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'Strong@Password1' -d demo -C \
  -i /dev/stdin < scripts/demo-database-sqlserver.sql

# Connection: localhost:1433, database: demo, user: sa, password: Strong@Password1
```

### SQLite

```bash
# Create SQLite database (no container needed)
mkdir -p data
sqlite3 data/demo.db < scripts/demo-database-sqlite.sql

# Connection: filepath = ./data/demo.db
```

The demo database includes tables for organizations, subscriptions, products, invoices, usage events, support tickets, and more - perfect for exploring business analytics queries.

---

## Landing Page

A product landing page is available at `/landing` showcasing features, screenshots, and installation instructions. See [app/landing/README.md](./app/landing/README.md) for customization details.

---

## Documentation

Comprehensive developer documentation is available in the [docs](./docs) folder:

| Topic | Link |
|-------|------|
| Documentation Index | [docs/README.md](./docs/README.md) |
| Architecture Overview | [docs/architecture/overview.md](./docs/architecture/overview.md) |
| State Management | [docs/architecture/state-management.md](./docs/architecture/state-management.md) |
| API Reference | [docs/api/overview.md](./docs/api/overview.md) |
| Component Guide | [docs/components/overview.md](./docs/components/overview.md) |
| Data Models | [docs/models/overview.md](./docs/models/overview.md) |
| Getting Started Guide | [docs/guides/getting-started.md](./docs/guides/getting-started.md) |
| OpenAI Integration | [docs/guides/openai-integration.md](./docs/guides/openai-integration.md) |
| Testing Plan | [docs/testing-plan.md](./docs/testing-plan.md) |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, shadcn/ui, Tailwind CSS |
| State | React Context + localStorage |
| Databases | PostgreSQL, MySQL, SQL Server, SQLite |
| AI | OpenAI API (Responses API) |
| Charts | Recharts |

---

## Commands

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm start             # Start production server
npm run lint          # Run linter
docker-compose up     # Start with Docker (includes build)
docker-compose up -d  # Start in detached mode
```

---

## Environment Variables

Create a `.env.local` file with:

```bash
OPENAI_API_KEY=sk-...    # Required for AI features
OPENAI_MODEL=gpt-5       # Model for query generation (optional)
DEMO_RATE_LIMIT=         # Optional: limit API requests per IP per 24h (empty = unlimited)
```

### Rate Limiting & Bring Your Own Key (BYOK)

For demo deployments, you can limit OpenAI API usage per IP address:

- **`DEMO_RATE_LIMIT`**: Set to a number (e.g., `10`) to limit requests per 24-hour window per IP
- **User API Keys**: Users can bypass rate limits by providing their own OpenAI API key via the settings dialog
- Leave `DEMO_RATE_LIMIT` empty or unset to disable rate limiting

---

## Roadmap

- [x] ~~Support additional database types (MySQL, SQLite, MSSQL)~~ - **Completed!**
- [ ] Enhanced chart creation and customization
- [ ] Report scheduling
- [ ] Team collaboration features
- [ ] Query history and favorites

---

## License

MIT
