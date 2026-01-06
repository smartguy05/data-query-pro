# DataQuery Pro - Comprehensive Testing Plan

This document provides a complete testing plan for DataQuery Pro using Playwright MCP (Model Context Protocol) for browser automation. It covers all application features across multiple server configurations.

## Table of Contents

1. [Test Environment Setup](#test-environment-setup)
2. [Test Phases Overview](#test-phases-overview)
3. [Phase 1: Baseline Tests](#phase-1-baseline-tests)
4. [Phase 2: Server Configuration Tests](#phase-2-server-configuration-tests)
5. [Phase 3: Rate Limiting Tests](#phase-3-rate-limiting-tests)
6. [Phase 4: AI Integration Tests](#phase-4-ai-integration-tests)
7. [Error Handling Tests](#error-handling-tests)
8. [Test Data Cleanup](#test-data-cleanup)
9. [Screenshot Capture Points](#screenshot-capture-points)

---

## Test Environment Setup

### Prerequisites

- Node.js 18+ installed
- Podman or Docker installed
- OpenAI API key with sufficient credits
- Playwright MCP server configured

### PostgreSQL Container Setup

Start a PostgreSQL container with the demo database:

```bash
# Start PostgreSQL container with Podman
podman run -d \
  --name demo-postgres \
  -e POSTGRES_USER=demo \
  -e POSTGRES_PASSWORD=demo \
  -e POSTGRES_DB=cloudmetrics \
  -p 5432:5432 \
  postgres:15

# Wait for container to be ready
podman exec demo-postgres pg_isready -U demo -d cloudmetrics

# Populate database with demo data
cat scripts/demo-database.sql | podman exec -i demo-postgres psql -U demo -d cloudmetrics
```

### Demo Database Contents (CloudMetrics Inc.)

The demo database simulates a SaaS analytics platform with:

| Table | Description | Approximate Rows |
|-------|-------------|------------------|
| `regions` | Geographic regions | 5 |
| `industries` | Business industries | 8 |
| `organizations` | Customer organizations | 50 |
| `teams` | Teams within organizations | ~100 |
| `users` | User accounts | ~500 |
| `products` | Subscription products | 4 tiers |
| `subscriptions` | Active subscriptions | ~50 |
| `invoices` | Billing invoices | ~600-1200 |
| `usage_events` | User activity logs | ~25,000 |
| `support_tickets` | Support requests | ~200 |
| `support_ticket_comments` | Ticket responses | ~500 |

**Views:**
- `monthly_revenue` - Revenue aggregated by month
- `customer_health` - Customer health scores

### Environment Variables

Create or modify `.env.local` based on the test phase:

```bash
# Base configuration (all phases)
OPENAI_API_KEY=sk-...        # Your OpenAI API key
OPENAI_MODEL=gpt-4o          # Or gpt-4o-mini for faster/cheaper tests

# Phase 1 & 2: No rate limiting
DEMO_RATE_LIMIT=             # Empty or not set

# Phase 3: With rate limiting
DEMO_RATE_LIMIT=2            # Low limit for testing (2 requests per 24h)
```

### PostgreSQL Connection Details

Use these credentials for test connections:

| Field | Value |
|-------|-------|
| Host | `localhost` or `127.0.0.1` |
| Port | `5432` |
| Database | `cloudmetrics` |
| Username | `demo` |
| Password | `demo` |

---

## Test Phases Overview

| Phase | Configuration | Purpose |
|-------|---------------|---------|
| Phase 1 | No rate limit, no server config | Baseline feature testing |
| Phase 2 | Server config enabled | Test pre-configured connections |
| Phase 3 | Rate limiting enabled | Test BYOK and rate limit features |
| Phase 4 | Full configuration | AI integration quality tests |

---

## Phase 1: Baseline Tests

**Configuration:**
- `DEMO_RATE_LIMIT` not set or empty
- `config/databases.json` does NOT exist
- PostgreSQL container running

### 1.1 Landing Page (`/landing`)

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| L-01 | Page loads | Navigate to `/landing` | Page renders with hero section |
| L-02 | Navigation links | Check header links | All nav links present and clickable |
| L-03 | Theme toggle | Click theme button | Toggles between light/dark mode |
| L-04 | CTA buttons | Click "Get Started" | Navigates to dashboard |
| L-05 | Feature sections | Scroll page | All feature sections visible |
| L-06 | Footer links | Check footer | All links functional |

### 1.2 Dashboard Page (`/`)

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| D-01 | Empty state | Load with no connections | Shows setup progress, prompts to add connection |
| D-02 | Setup progress | Check progress indicators | Shows 4 steps: Connect, Introspect, AI Descriptions, Query |
| D-03 | Quick actions | Verify action cards | All 4 actions visible and clickable |
| D-04 | No suggestions state | Before AI setup | Shows "No suggestions yet" message |
| D-05 | AI suggestions | After schema upload | Shows 3-5 metric suggestions |
| D-06 | Click suggestion | Click suggested metric | Navigates to query page with pre-filled query |

### 1.3 Database Connection Page (`/database`)

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| DB-01 | Page loads | Navigate to `/database` | Shows tabs: New/Existing, connection form |
| DB-02 | New connection tab | Click "New Connection" | Shows connection form |
| DB-03 | Database type dropdown | Open dropdown | Shows PostgreSQL, MySQL, SQL Server, SQLite |
| DB-04 | PostgreSQL form | Select PostgreSQL | Shows host, port (5432), database, username, password fields |
| DB-05 | Fill connection form | Enter demo PostgreSQL details | All fields accept input |
| DB-06 | Test connection | Click "Test Connection" | Shows success toast, API call succeeds |
| DB-07 | Save connection | Click "Save & Connect" | Connection saved, navigates to schema page |
| DB-08 | Existing connections tab | Click "Existing" | Shows saved connections list |
| DB-09 | Select existing | Click saved connection | Connection becomes active |
| DB-10 | Edit connection | Click edit button | Opens edit form with pre-filled data |
| DB-11 | Delete connection | Click delete button | Shows confirmation, removes on confirm |
| DB-12 | Export connections | Click export | Downloads JSON file with connections |
| DB-13 | Import connections | Upload JSON file | Imports and shows connections |
| DB-14 | Connection status | Check status indicators | Shows connected/disconnected status |

### 1.4 Schema Explorer Page (`/schema`)

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| S-01 | Page loads | Navigate to `/schema` | Shows schema explorer or prompt to connect |
| S-02 | No connection state | Without active connection | Shows "Connect to database" prompt |
| S-03 | Introspect schema | Click "Introspect Schema" | Starts introspection, shows progress |
| S-04 | Schema tree | After introspection | Shows table tree with all 19+ tables |
| S-05 | Expand table | Click table name | Shows columns with types |
| S-06 | Column details | Hover/click column | Shows data type, constraints, FK info |
| S-07 | Hide table | Click hide toggle on table | Table marked as hidden |
| S-08 | Hide column | Click hide toggle on column | Column marked as hidden |
| S-09 | Search tables | Type in search box | Filters tables by name |
| S-10 | Generate descriptions | Click "Generate AI Descriptions" | AI generates table/column descriptions |
| S-11 | Description display | After generation | Tables show AI-generated descriptions |
| S-12 | Manual description edit | Click edit on description | Opens edit modal, saves changes |
| S-13 | Upload schema | Click "Upload to OpenAI" | Uploads schema file, creates vector store |
| S-14 | Upload success | After upload | Shows success message, enables querying |
| S-15 | Unsaved changes warning | Make changes, try to leave | Shows warning dialog |
| S-16 | Re-introspect | Click introspect again | Detects schema changes, marks new items |

### 1.5 Query Page (`/query`)

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| Q-01 | Page loads | Navigate to `/query` | Shows query input area |
| Q-02 | No schema warning | Without uploaded schema | Shows "Upload schema first" message |
| Q-03 | Query input | Type natural language query | Input accepts text |
| Q-04 | Generate SQL | Click "Generate SQL" | AI generates SQL query |
| Q-05 | SQL display | After generation | Shows generated SQL with explanation |
| Q-06 | Confidence indicator | Check confidence level | Shows confidence % and warnings if low |
| Q-07 | Execute query | Click "Run Query" | Executes SQL, shows results |
| Q-08 | Results table | After execution | Shows data in table format |
| Q-09 | Results pagination | With many rows | Pagination controls work |
| Q-10 | Chart view | Click chart toggle | Switches to chart visualization |
| Q-11 | Chart types | Select different chart type | Renders bar, line, pie, area, scatter |
| Q-12 | Follow-up query | Type follow-up question | AI generates related query |
| Q-13 | Revise query | Click "Revise" | Opens revise modal, regenerates SQL |
| Q-14 | Query history | Check history | Shows previous queries |
| Q-15 | Save as report | Click "Save as Report" | Opens save dialog |
| Q-16 | Export results | Click export | Downloads CSV/JSON |
| Q-17 | Copy SQL | Click copy button | SQL copied to clipboard |

**Test Queries to Execute:**

| Query | Expected Behavior |
|-------|-------------------|
| "Show me total revenue by month" | Queries invoices table with DATE_TRUNC |
| "Which organizations have the most support tickets?" | Joins support_tickets with organizations |
| "Show user login activity over the past 30 days" | Queries usage_events with date filter |
| "What products are most popular?" | Queries subscriptions with products |
| "Show organizations by region and industry" | Joins organizations with regions/industries |
| "Count active users by organization" | Filters users WHERE is_active = true |

### 1.6 Reports Page (`/reports`)

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| R-01 | Page loads | Navigate to `/reports` | Shows reports list or empty state |
| R-02 | Empty state | No saved reports | Shows "No reports yet" message |
| R-03 | Create report | Save query as report | Report appears in list |
| R-04 | Report card | View saved report | Shows name, description, last run |
| R-05 | Run report | Click "Run" button | Executes report, shows results |
| R-06 | Edit report | Click edit button | Opens edit dialog |
| R-07 | Edit name | Change report name | Name updates successfully |
| R-08 | Edit description | Change description | Description saves |
| R-09 | Clone report | Click clone button | Creates copy with "(Copy)" suffix |
| R-10 | Delete report | Click delete button | Shows confirm, removes on confirm |
| R-11 | Search reports | Type in search | Filters reports by name/description |
| R-12 | Parameter config | Add parameter to report | Parameter saved to report |
| R-13 | Run with parameters | Run parameterized report | Shows parameter input dialog |
| R-14 | Parameter types | Create text/number/date params | Each type renders correctly |
| R-15 | Required parameters | Leave required empty | Shows validation error |
| R-16 | Export report | Export as JSON | Downloads report definition |

### 1.7 Navigation and Global Features

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| N-01 | Navigation bar | Check all pages | Nav bar visible on all pages |
| N-02 | Active link | Navigate between pages | Active page highlighted |
| N-03 | Connection indicator | Check header | Shows current connection name |
| N-04 | API key indicator | Check header | Shows key status (green checkmark if set) |
| N-05 | Theme persistence | Toggle theme, refresh | Theme persists after refresh |
| N-06 | Mobile responsive | Resize to mobile | Layout adapts, hamburger menu appears |
| N-07 | Keyboard navigation | Tab through elements | Focus visible, tab order logical |
| N-08 | Toast notifications | Trigger action | Toast appears and auto-dismisses |

---

## Phase 2: Server Configuration Tests

**Setup:**

1. Stop the dev server
2. Create `config/databases.json`:

```json
{
  "connections": [
    {
      "id": "server-postgres",
      "name": "CloudMetrics Demo (Server)",
      "description": "Pre-configured PostgreSQL connection from server",
      "type": "postgresql",
      "host": "localhost",
      "port": 5432,
      "database": "cloudmetrics",
      "username": "demo",
      "password": "demo"
    }
  ]
}
```

3. Restart the dev server

### Server Configuration Tests

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| SC-01 | Server connection loads | Navigate to `/database` | Shows server connection with "Server Config" badge |
| SC-02 | Cannot edit server conn | Click edit on server conn | Edit disabled or shows read-only warning |
| SC-03 | Cannot delete server conn | Try to delete | Delete disabled for server connections |
| SC-04 | Can use server conn | Select server connection | Connection works, can introspect |
| SC-05 | Mixed connections | Add local connection | Both server and local connections shown |
| SC-06 | Server conn priority | Check order | Server connections listed first |
| SC-07 | Schema from config | Check schema loading | Server-provided schemas load correctly |
| SC-08 | Current connection | Refresh page | Last selected connection restored |

---

## Phase 3: Rate Limiting Tests

**Setup:**

1. Stop the dev server
2. Set `DEMO_RATE_LIMIT=2` in `.env.local`
3. Restart the dev server
4. Clear browser session storage (new browser session or incognito)

### Rate Limit Tests

| Test ID | Test Case | Steps | Expected Result |
|---------|-----------|-------|-----------------|
| RL-01 | Rate limit status | Check API status endpoint | Returns limit info |
| RL-02 | Initial requests work | Make 2 AI requests | Both succeed |
| RL-03 | Rate limit hit | Make 3rd request | Returns 429 error |
| RL-04 | Rate limit message | After hitting limit | Shows "Rate limit exceeded" message |
| RL-05 | API key indicator | Check nav | Shows warning when limited |
| RL-06 | Rate limit dialog | After 429 error | Shows "Demo Limit Reached" dialog |
| RL-07 | Enter own API key | Click key indicator, enter key | Key saved to sessionStorage |
| RL-08 | Bypass with own key | Make request with own key | Request succeeds (bypasses limit) |
| RL-09 | Key persists in session | Refresh page | Key still present in session |
| RL-10 | Clear key | Click "Clear API Key" | Key removed from sessionStorage |
| RL-11 | Limit applies again | After clearing key | Rate limit applies again |

### Rate-Limited Endpoints

These endpoints are affected by rate limiting:

- `POST /api/query/generate` - Natural language to SQL
- `POST /api/schema/generate-descriptions` - AI table descriptions
- `POST /api/dashboard/suggestions` - AI metric suggestions
- `POST /api/chart/generate` - AI chart configuration

---

## Phase 4: AI Integration Tests

### AI Query Generation Quality Tests

| Test ID | Query | Expected SQL Pattern |
|---------|-------|----------------------|
| AI-01 | "How many organizations are there?" | `SELECT COUNT(*) FROM organizations` |
| AI-02 | "Total revenue by month" | `SELECT ... SUM(total) ... GROUP BY month` |
| AI-03 | "Organizations by industry" | JOIN organizations + industries |
| AI-04 | "Active Enterprise subscriptions" | WHERE status='active' AND product filter |
| AI-05 | "Users with most support tickets" | Multiple table join with GROUP BY |
| AI-06 | "Usage events from last 7 days" | WHERE created_at > NOW() - INTERVAL |
| AI-07 | "Top 10 organizations by revenue" | ORDER BY ... LIMIT 10 |
| AI-08 | "Show me everything" | Returns clarification or reasonable default |

### AI Description Generation Tests

| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| AD-01 | Generate all | Click generate descriptions | All tables get descriptions |
| AD-02 | Business context | Check description quality | Descriptions are business-relevant |
| AD-03 | Column descriptions | Check columns | FK columns explain relationships |
| AD-04 | Retry on failure | If description fails | Retry mechanism works |

### AI Suggestions Tests

| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| AS-01 | Generate suggestions | On dashboard | Returns 3-5 metric suggestions |
| AS-02 | Suggestion quality | Review suggestions | Relevant to SaaS analytics |
| AS-03 | Click suggestion | Click suggested metric | Navigates to query page, pre-fills query |
| AS-04 | Regenerate | Click regenerate | Gets new suggestions |
| AS-05 | Cache | Return to dashboard | Same suggestions (cached) |

---

## Error Handling Tests

| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| E-01 | Invalid connection | Wrong credentials | Shows connection error, doesn't crash |
| E-02 | Network error | Disconnect network | Shows network error message |
| E-03 | Invalid query | Generate invalid SQL | Shows error, allows retry |
| E-04 | Empty results | Query with no matches | Shows "No results" message |
| E-05 | Large results | Query returning 10000+ rows | Paginates, doesn't freeze |
| E-06 | API timeout | Long-running AI request | Shows timeout, allows retry |
| E-07 | Invalid schema | Corrupt localStorage | Handles gracefully, offers reset |
| E-08 | Vector store expired | OpenAI store deleted | Prompts to re-upload schema |

---

## Test Data Cleanup

After all tests are complete:

```bash
# Stop and remove PostgreSQL container
podman stop demo-postgres
podman rm demo-postgres

# Remove server config (if created)
rm config/databases.json

# Reset environment variables
# Remove or comment out DEMO_RATE_LIMIT in .env.local

# Clear browser data (optional)
# Clear localStorage and sessionStorage in browser dev tools
```

---

## Screenshot Capture Points

Capture screenshots at these key moments for documentation:

| Screenshot | Page | Trigger |
|------------|------|---------|
| `01-landing-hero.png` | `/landing` | Page load |
| `02-dashboard-empty.png` | `/` | No connections |
| `03-connection-form.png` | `/database` | Form filled out |
| `04-connection-success.png` | `/database` | Test success toast |
| `05-schema-introspected.png` | `/schema` | After introspection |
| `06-schema-descriptions.png` | `/schema` | After AI descriptions |
| `07-query-input.png` | `/query` | Natural language entered |
| `08-query-generated.png` | `/query` | SQL generated |
| `09-query-results-table.png` | `/query` | Results displayed |
| `10-query-results-chart.png` | `/query` | Chart visualization |
| `11-reports-list.png` | `/reports` | Reports page |
| `12-server-config-badge.png` | `/database` | Server connection badge |
| `13-rate-limit-dialog.png` | `/query` | Rate limit exceeded |
| `14-api-key-configured.png` | `/query` | User key indicator |

---

## Test Execution Checklist

### Pre-Test Checklist

- [ ] PostgreSQL container is running
- [ ] Demo database is populated
- [ ] Environment variables are set correctly for the phase
- [ ] Dev server is running
- [ ] Browser session is fresh (for rate limit tests)

### Phase Execution Order

1. **Phase 1** (Day 1)
   - [ ] Landing page tests (L-01 to L-06)
   - [ ] Dashboard tests (D-01 to D-06)
   - [ ] Database connection tests (DB-01 to DB-14)
   - [ ] Schema explorer tests (S-01 to S-16)
   - [ ] Query page tests (Q-01 to Q-17)
   - [ ] Reports page tests (R-01 to R-16)
   - [ ] Navigation tests (N-01 to N-08)

2. **Phase 2** (Day 2)
   - [ ] Create server config file
   - [ ] Restart server
   - [ ] Server config tests (SC-01 to SC-08)

3. **Phase 3** (Day 2)
   - [ ] Set DEMO_RATE_LIMIT=2
   - [ ] Restart server
   - [ ] Clear browser session
   - [ ] Rate limit tests (RL-01 to RL-11)

4. **Phase 4** (Day 2)
   - [ ] AI query tests (AI-01 to AI-08)
   - [ ] AI description tests (AD-01 to AD-04)
   - [ ] AI suggestion tests (AS-01 to AS-05)

5. **Error Handling** (Day 3)
   - [ ] Error tests (E-01 to E-08)

### Post-Test Checklist

- [ ] All screenshots captured
- [ ] Test results documented
- [ ] Environment cleaned up
- [ ] Any bugs logged

---

## Success Criteria

All tests pass when:

1. **Phase 1**: All baseline features work without server config or rate limits
2. **Phase 2**: Server-configured connections display correctly with read-only badges
3. **Phase 3**: Rate limiting enforces limits and BYOK bypasses them correctly
4. **Phase 4**: AI features return valid, contextually relevant responses
5. **Error Handling**: Application handles errors gracefully without crashing

---

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if container is running
podman ps

# Check PostgreSQL logs
podman logs demo-postgres

# If authentication fails, update pg_hba.conf
podman exec -u postgres demo-postgres sh -c \
  "sed -i 's/scram-sha-256/trust/' /var/lib/postgresql/data/pg_hba.conf && \
   pg_ctl reload -D /var/lib/postgresql/data"
```

### Server Won't Start

```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000  # Windows
lsof -i :3000                  # Mac/Linux

# Kill process using port
taskkill /PID <pid> /F         # Windows
kill -9 <pid>                  # Mac/Linux
```

### Rate Limit Not Resetting

The rate limit is IP-based with a 24-hour window. For testing:
- Use incognito/private browsing mode
- Clear sessionStorage between test runs
- Or wait for the window to expire

### OpenAI API Errors

- **401 Unauthorized**: Check API key is valid
- **429 Rate Limited**: OpenAI rate limit (different from app rate limit)
- **500 Internal Error**: Check server logs for details
