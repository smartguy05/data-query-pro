# Phase 2: Server Configuration Tests

Test pre-configured connections loaded from `config/databases.json`.
See [Testing Plan](./README.md) for environment setup.

## Setup

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

## Tests

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

## Related Documentation
- [Testing Plan index](./README.md)
- [Phase 1: Baseline](./phase-1-baseline.md)
- [Phase 3: Rate Limiting](./phase-3-rate-limiting.md)
- [config/README.md](../../config/README.md) - Server config file format
