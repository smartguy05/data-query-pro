# Phase 4: AI Integration Tests

Quality tests for AI query generation, descriptions, and suggestions.
See [Testing Plan](./README.md) for environment setup.

## AI Query Generation Quality

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

## AI Description Generation

| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| AD-01 | Generate all | Click generate descriptions | All tables get descriptions |
| AD-02 | Business context | Check description quality | Descriptions are business-relevant |
| AD-03 | Column descriptions | Check columns | FK columns explain relationships |
| AD-04 | Retry on failure | If description fails | Retry mechanism works |

## AI Suggestions

| Test ID | Test Case | Steps | Expected |
|---------|-----------|-------|----------|
| AS-01 | Generate suggestions | On dashboard | Returns 3-5 metric suggestions |
| AS-02 | Suggestion quality | Review suggestions | Relevant to SaaS analytics |
| AS-03 | Click suggestion | Click suggested metric | Navigates to query page, pre-fills query |
| AS-04 | Regenerate | Click regenerate | Gets new suggestions |
| AS-05 | Cache | Return to dashboard | Same suggestions (cached) |

---

## Related Documentation
- [Testing Plan index](./README.md)
- [Phase 3: Rate Limiting](./phase-3-rate-limiting.md)
- [OpenAI Integration](../guides/openai-integration.md) - How AI features work
