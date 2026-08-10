# Phase 4: AI Integration Tests

Quality tests for AI query generation, descriptions, and suggestions.
See [Testing Plan](./README.md) for environment setup.

## AI Query Generation Quality

> **These 8 cases are now automated.** All of AI-01..AI-08 exist in the NL→SQL eval
> harness (`evals/dataset.ts`, tagged `phase4`) with authored golden SQL, so correctness
> is checked by comparing result sets rather than by eyeballing the generated SQL. They
> are part of the harness's default **core** question set, which runs every time:
>
> ```bash
> pnpm eval -- --models gpt-5.4 --trials 3
>
> # just the phase 4 questions
> pnpm eval -- --models gpt-5.4 --trials 3 --questions "Q01,Q08,Q11,Q15,Q20,Q23,Q26,Q30"
> ```
>
> The harness needs the demo Postgres on port 5433, a running dev server, and
> `EVAL_ALLOW_MODEL_OVERRIDE=true` — see [evals/README.md](../../evals/README.md) for
> setup, flags, cost, and how results are reported. The table below is kept because it
> still documents the *intent* of each case; run it manually only when you want to
> inspect the UI behavior (explanation text, confidence, warnings) rather than SQL
> correctness.

| Test ID | Eval ID | Query | Expected SQL Pattern |
|---------|---------|-------|----------------------|
| AI-01 | Q01 | "How many organizations are there?" | `SELECT COUNT(*) FROM organizations` |
| AI-02 | Q26 | "Total revenue by month" | `SELECT ... SUM(total) ... GROUP BY month` |
| AI-03 | Q08 | "Organizations by industry" | JOIN organizations + industries |
| AI-04 | Q11 | "Active Enterprise subscriptions" | WHERE status='active' AND product filter |
| AI-05 | Q15 | "Users with most support tickets" | Multiple table join with GROUP BY |
| AI-06 | Q20 | "Usage events from last 7 days" | WHERE created_at > NOW() - INTERVAL |
| AI-07 | Q23 | "Top 10 organizations by revenue" | ORDER BY ... LIMIT 10 |
| AI-08 | Q30 | "Show me everything" | Returns clarification or reasonable default |

The eval phrasings are more specific than the shorthand above (the uploaded schema is
structure-only, so questions must quote data literals verbatim) — `evals/dataset.ts` is
the authority on exact wording and golden SQL.

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
- [NL→SQL Eval Harness](../../evals/README.md) - Automated coverage for AI-01..AI-08
- [OpenAI Integration](../guides/openai-integration.md) - How AI features work
