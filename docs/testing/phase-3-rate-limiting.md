# Phase 3: Rate Limiting Tests

Test IP-based rate limiting and BYOK (bring-your-own-key) bypass.
See [Testing Plan](./README.md) for environment setup.

## Setup

1. Stop the dev server
2. Set `DEMO_RATE_LIMIT=2` in `.env.local`
3. Restart the dev server
4. Clear browser session storage (new browser session or incognito)

## Tests

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

## Rate-Limited Endpoints

These endpoints are affected by rate limiting:

- `POST /api/query/generate` - Natural language to SQL
- `POST /api/schema/generate-descriptions` - AI table descriptions
- `POST /api/dashboard/suggestions` - AI metric suggestions
- `POST /api/chart/generate` - AI chart configuration

---

## Related Documentation
- [Testing Plan index](./README.md)
- [Phase 4: AI Integration](./phase-4-ai-integration.md)
- [API Overview → Rate Limiting](../api/overview.md#rate-limiting)
