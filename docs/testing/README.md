# Testing Plan

A complete manual/automation testing plan for DataQuery Pro using **Playwright MCP** for
browser automation. It covers all features across multiple server configurations.

## Phases

| Phase | Configuration | Purpose | Doc |
|-------|---------------|---------|-----|
| Phase 1 | No rate limit, no server config | Baseline feature testing | [phase-1-baseline.md](./phase-1-baseline.md) |
| Phase 2 | Server config enabled | Pre-configured connections | [phase-2-server-config.md](./phase-2-server-config.md) |
| Phase 3 | Rate limiting enabled | BYOK and rate limit features | [phase-3-rate-limiting.md](./phase-3-rate-limiting.md) |
| Phase 4 | Full configuration | AI integration quality | [phase-4-ai-integration.md](./phase-4-ai-integration.md) |

Error-handling tests are included at the end of [Phase 1](./phase-1-baseline.md#error-handling-tests).

---

## Test Environment Setup

### Prerequisites

- Node.js 18+ installed
- Podman or Docker installed
- OpenAI API key with sufficient credits
- Playwright MCP server configured

### PostgreSQL Container Setup

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

A SaaS analytics platform sample:

| Table | Description | Approx. Rows |
|-------|-------------|------|
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

**Views:** `monthly_revenue`, `customer_health`.

### Environment Variables

```bash
# Base configuration (all phases)
OPENAI_API_KEY=sk-...        # Your OpenAI API key
OPENAI_MODEL=gpt-5           # Or a faster/cheaper model for tests

# Phase 1 & 2: No rate limiting
DEMO_RATE_LIMIT=             # Empty or not set

# Phase 3: With rate limiting
DEMO_RATE_LIMIT=2            # Low limit for testing (2 requests per 24h)
```

### PostgreSQL Connection Details

| Field | Value |
|-------|-------|
| Host | `localhost` or `127.0.0.1` |
| Port | `5432` |
| Database | `cloudmetrics` |
| Username | `demo` |
| Password | `demo` |

---

## Execution Checklist

### Pre-Test
- [ ] PostgreSQL container is running
- [ ] Demo database is populated
- [ ] Environment variables set correctly for the phase
- [ ] Dev server is running
- [ ] Browser session is fresh (for rate limit tests)

### Order
1. **Phase 1** — [baseline](./phase-1-baseline.md): Landing, Dashboard, Database, Schema, Query, Reports, Navigation, Error handling
2. **Phase 2** — [server config](./phase-2-server-config.md): create `config/databases.json`, restart, SC-01..SC-08
3. **Phase 3** — [rate limiting](./phase-3-rate-limiting.md): set `DEMO_RATE_LIMIT=2`, restart, fresh session, RL-01..RL-11
4. **Phase 4** — [AI integration](./phase-4-ai-integration.md): AI-01..AI-08, AD-01..AD-04, AS-01..AS-05

### Post-Test
- [ ] All screenshots captured
- [ ] Test results documented
- [ ] Environment cleaned up
- [ ] Any bugs logged

---

## Success Criteria

1. **Phase 1**: All baseline features work without server config or rate limits
2. **Phase 2**: Server-configured connections display correctly with read-only badges
3. **Phase 3**: Rate limiting enforces limits and BYOK bypasses them correctly
4. **Phase 4**: AI features return valid, contextually relevant responses
5. **Error Handling**: Application handles errors gracefully without crashing

---

## Screenshot Capture Points

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

## Test Data Cleanup

```bash
# Stop and remove PostgreSQL container
podman stop demo-postgres && podman rm demo-postgres

# Remove server config (if created)
rm config/databases.json

# Reset environment: remove/comment DEMO_RATE_LIMIT in .env.local
# Clear localStorage and sessionStorage in browser dev tools (optional)
```

---

## Troubleshooting

### PostgreSQL Connection Issues
```bash
podman ps                    # Is the container running?
podman logs demo-postgres    # Check logs

# If authentication fails, switch to trust auth:
podman exec -u postgres demo-postgres sh -c \
  "sed -i 's/scram-sha-256/trust/' /var/lib/postgresql/data/pg_hba.conf && \
   pg_ctl reload -D /var/lib/postgresql/data"
```

### Server Won't Start
```bash
netstat -ano | findstr :3000   # Windows: find process on port 3000
taskkill /PID <pid> /F         # Windows: kill it
lsof -i :3000                  # Mac/Linux
kill -9 <pid>                  # Mac/Linux
```

### Rate Limit Not Resetting
IP-based with a 24-hour window. Use incognito, clear sessionStorage between runs, or wait
for the window to expire.

### OpenAI API Errors
- **401 Unauthorized**: Check API key is valid
- **429 Rate Limited**: OpenAI's own rate limit (distinct from the app's `DEMO_RATE_LIMIT`)
- **500 Internal Error**: Check server logs

---

## Related Documentation
- [Getting Started](../guides/getting-started.md) - Setup
- [Authentication Testing](../guides/authentication-testing.md) - OIDC test environment
- [API Overview](../api/overview.md) - Endpoints under test
