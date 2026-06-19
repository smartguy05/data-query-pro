# File Map — Where Does X Live?

A lookup table from features, routes, components, and concerns to their **source path**
and the **doc** that covers them. Optimized for fast "where is this?" navigation.

> Paths are relative to the repo root. When in doubt, this map is the fastest way to jump
> from a feature name to the code and the relevant documentation.

## Pages (routes → source → doc)

| Route | Source | Doc |
|-------|--------|-----|
| `/` (Dashboard) | `app/page.tsx` | [pages.md](../components/pages.md#dashboard-page) |
| `/database` | `app/database/page.tsx` | [pages.md](../components/pages.md#database-page) |
| `/schema` | `app/schema/page.tsx` | [pages.md](../components/pages.md#schema-page) |
| `/query` | `app/query/page.tsx` | [pages.md](../components/pages.md#query-page) |
| `/history` | `app/history/page.tsx` | [pages.md](../components/pages.md#history-page) |
| `/learning` | `app/learning/page.tsx` | [pages.md](../components/pages.md#learning-page) |
| `/reports` | `app/reports/page.tsx` | [pages.md](../components/pages.md#reports-page) |
| `/profile` | `app/profile/page.tsx` | [pages.md](../components/pages.md#profile-page) |
| `/admin` | `app/admin/page.tsx` | [pages.md](../components/pages.md#admin-page) |
| `/landing` | `app/landing/page.tsx` | [pages.md](../components/pages.md#landing-page) |
| `/auth/login` | `app/auth/login/page.tsx` | [pages.md](../components/pages.md#auth-login-page) |
| Root layout | `app/layout.tsx` | [pages.md](../components/pages.md#layout-component) |

## API Routes (route → source → doc)

| Route | Source | Doc |
|-------|--------|-----|
| `/api/query/generate` | `app/api/query/generate/route.ts` | [query-endpoints.md](../api/query-endpoints.md) |
| `/api/query/execute` | `app/api/query/execute/route.ts` | [query-endpoints.md](../api/query-endpoints.md) |
| `/api/query/enhance` | `app/api/query/enhance/route.ts` | [query-endpoints.md](../api/query-endpoints.md) |
| `/api/query/revise` | `app/api/query/revise/route.ts` | [query-endpoints.md](../api/query-endpoints.md) |
| `/api/query/followup` | `app/api/query/followup/route.ts` | [query-endpoints.md](../api/query-endpoints.md) |
| `/api/schema/introspect` | `app/api/schema/introspect/route.ts` | [schema-endpoints.md](../api/schema-endpoints.md) |
| `/api/schema/start-introspection` | `app/api/schema/start-introspection/route.ts` | [schema-endpoints.md](../api/schema-endpoints.md) |
| `/api/schema/status` | `app/api/schema/status/route.ts` | [schema-endpoints.md](../api/schema-endpoints.md) |
| `/api/schema/upload-schema` | `app/api/schema/upload-schema/route.ts` | [schema-endpoints.md](../api/schema-endpoints.md) |
| `/api/schema/generate-descriptions` | `app/api/schema/generate-descriptions/route.ts` | [schema-endpoints.md](../api/schema-endpoints.md) |
| `/api/schema/update-description` | `app/api/schema/update-description/route.ts` | [schema-endpoints.md](../api/schema-endpoints.md) |
| `/api/schema/sample-data` | `app/api/schema/sample-data/route.ts` | [schema-endpoints.md](../api/schema-endpoints.md#post-apischemasample-data) |
| `/api/dashboard/suggestions` | `app/api/dashboard/suggestions/route.ts` | [dashboard-endpoints.md](../api/dashboard-endpoints.md) |
| `/api/chart/generate` | `app/api/chart/generate/route.ts` | [dashboard-endpoints.md](../api/dashboard-endpoints.md) |
| `/api/connection/test` | `app/api/connection/test/route.ts` | [data-endpoints.md](../api/data-endpoints.md#connection-test) |
| `/api/data/*` | `app/api/data/**/route.ts` | [data-endpoints.md](../api/data-endpoints.md#data-endpoints-apidata) |
| `/api/admin/*` | `app/api/admin/**/route.ts` | [data-endpoints.md](../api/data-endpoints.md#admin-endpoints-apiadmin) |
| `/api/sharing/*` | `app/api/sharing/**/route.ts` | [data-endpoints.md](../api/data-endpoints.md#sharing-endpoints-apisharing) |
| `/api/config/*` | `app/api/config/**/route.ts` | [data-endpoints.md](../api/data-endpoints.md#config-endpoints-apiconfig) |
| `/api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.ts` | [data-endpoints.md](../api/data-endpoints.md#auth-endpoint) |

## Features (feature → key source → doc)

| Feature | Key source | Doc |
|---------|-----------|-----|
| State management (context) | `lib/database-connection-options.tsx` | [state-management.md](../architecture/state-management.md) |
| Storage abstraction | `lib/storage/storage-provider.ts` (+ local/api impls) | [auth-and-data-layer.md](../architecture/auth-and-data-layer.md#storage-abstraction) |
| Auth / OIDC | `lib/auth/auth-options.ts`, `lib/auth/require-auth.ts` | [auth-and-data-layer.md](../architecture/auth-and-data-layer.md) |
| App DB pool | `lib/db/pool.ts` | [auth-and-data-layer.md](../architecture/auth-and-data-layer.md#app-database-postgresql) |
| Migrations | `lib/db/migrations/*.sql`, `lib/db/migrate.ts`, `instrumentation.ts` | [auth-and-data-layer.md](../architecture/auth-and-data-layer.md#migrations) |
| Repositories | `lib/db/repositories/*.ts` | [auth-and-data-layer.md](../architecture/auth-and-data-layer.md#repositories) |
| Password encryption | `lib/db/encryption.ts` | [auth-and-data-layer.md](../architecture/auth-and-data-layer.md#credential-encryption) |
| Credential resolution | `lib/database/connection-validator.ts` | [auth-and-data-layer.md](../architecture/auth-and-data-layer.md#credential-resolution-for-target-databases) |
| Database adapters | `lib/database/adapters/*.adapter.ts`, `lib/database/factory.ts` | [adding-database-support.md](../guides/adding-database-support.md) |
| SQL dialect queries | `lib/database/queries/*.queries.ts` | [adding-database-support.md](../guides/adding-database-support.md) |
| Read-only SQL validator (AST) | `lib/database/sql-validator.ts` (`validateReadOnlySql`, `heuristicReadOnly` fallback) | [query-endpoints.md](../api/query-endpoints.md) |
| Query audit log | `lib/query-log.ts` (`logQuery`), `lib/query-log-file.ts`, `lib/db/repositories/query-log-repository.ts` | [auth-and-data-layer.md](../architecture/auth-and-data-layer.md) |
| Learn-from-queries (corrections + few-shot) | `utils/schema-fingerprint.ts`, `utils/example-relevance.ts`, `utils/query-corrections.ts`, `app/api/query/generate/route.ts` (`buildLearningSections`), `lib/db/repositories/query-correction-repository.ts`, `app/api/data/corrections/route.ts` (+ `[id]`) | [query-endpoints.md](../api/query-endpoints.md) |
| OpenAI integration | `lib/openai/schema-upload.ts`, query/schema routes | [openai-integration.md](../guides/openai-integration.md) |
| Rate limiting | `utils/rate-limiter.ts` | [api/overview.md](../api/overview.md#rate-limiting) |
| BYOK (user API key) | `hooks/use-openai-key.tsx`, `hooks/use-openai-fetch.tsx` | [infrastructure.md](../components/infrastructure.md#api-key-byok-components) |
| Error sanitization | `utils/error-sanitizer.ts` | [openai-integration.md](../guides/openai-integration.md) |
| Schema change detection | `utils/compare-schemas.ts` | [pages.md](../components/pages.md#schema-page) |
| Dashboard metric status/formatting | `utils/metric-status.ts` | [features.md](../components/features.md#dashboard-widgets) |
| Report parameter substitution | `utils/substitute-params.ts` | [features.md](../components/features.md#dashboard-widgets) |
| API response helpers | `lib/api/response.ts` | [data-endpoints.md](../api/data-endpoints.md#response-envelope) |

## Components (component → file → doc)

| Component | File | Doc |
|-----------|------|-----|
| SchemaExplorer | `components/schema-explorer.tsx` | [features.md](../components/features.md#schemaexplorer) |
| SchemaUpdateModal | `components/schema-update-modal.tsx` | [features.md](../components/features.md#schemaupdatemodal) |
| QueryResultsDisplay | `components/query-results-display.tsx` | [features.md](../components/features.md#queryresultsdisplay) |
| QueryTabContent | `components/query-tab-content.tsx` | [features.md](../components/features.md#querytabcontent) |
| FollowupDialog | `components/followup-dialog.tsx` | [features.md](../components/features.md#followupdialog) |
| ChartDisplay + charts/ | `components/chart-display.tsx`, `components/charts/*` | [features.md](../components/features.md#chart-components) |
| ComposedChart | `components/charts/composed-chart.tsx` | [features.md](../components/features.md#composed-chart) |
| ChartCustomizer | `components/chart-customizer.tsx` | [features.md](../components/features.md#chartcustomizer) |
| Report components | `components/save-report-dialog.tsx`, `edit-report-dialog.tsx`, `parameter-config.tsx`, `parameter-input-dialog.tsx`, `saved-reports.tsx` | [features.md](../components/features.md#report-components) |
| Export / Import Reports | `components/export-reports-dialog.tsx`, `components/import-reports-dialog.tsx` | [features.md](../components/features.md#report-components) |
| Dashboard widgets (KPIs / trend chart) | `components/executive-metrics.tsx`, `components/performance-chart.tsx`, `app/page.tsx` (`loadDashboardWidgets`) | [features.md](../components/features.md#dashboard-widgets) |
| Query accuracy stat / override | `app/page.tsx` (stat card), `components/query-tab-content.tsx` (thumbs), `lib/database-connection-options.tsx` (`recordQueryOutcome`/`overrideQueryOutcome`), `lib/db/repositories/query-accuracy-repository.ts`, `app/api/data/query-accuracy/route.ts`, `models/query-accuracy.interface.ts` | — |
| Dashboard (demo) components | `components/quick-actions.tsx`, `recent-reports.tsx`, `scheduled-reports.tsx`, `report-templates.tsx` | [features.md](../components/features.md#dashboard-components) |
| Providers | `components/auth-provider.tsx`, `openai-api-provider.tsx`, `theme-provider.tsx` | [infrastructure.md](../components/infrastructure.md#providers) |
| ContentLoadingGate / ErrorBoundary | `components/content-loading-gate.tsx`, `error-boundary.tsx` | [infrastructure.md](../components/infrastructure.md#loading--error-boundaries) |
| Navigation / Theme | `components/navigation.tsx`, `theme-toggle.tsx` | [infrastructure.md](../components/infrastructure.md#navigation--theme) |
| ShareDialog / DataMigrationDialog | `components/share-dialog.tsx`, `data-migration-dialog.tsx` | [infrastructure.md](../components/infrastructure.md#auth-mode-components) |
| ConfirmationModal | `components/confirmation-modal.tsx` | [infrastructure.md](../components/infrastructure.md#reusable-modals) |
| API key (BYOK) UI | `components/api-key-dialog.tsx`, `api-key-indicator.tsx` | [infrastructure.md](../components/infrastructure.md#api-key-byok-components) |

## Models & Hooks

| Item | File | Doc |
|------|------|-----|
| TypeScript interfaces | `models/*.interface.ts`, `models/common-types.ts` | [models/overview.md](../models/overview.md) |
| QueryAccuracy / QueryCorrection | `models/query-accuracy.interface.ts`, `models/query-correction.interface.ts` | [models/overview.md](../models/overview.md) |
| DashboardWidgetConfig + `SavedReport.visualization` | `models/saved-report.interface.ts` | [features.md](../components/features.md#dashboard-widgets) |
| ComposedChartConfig + `CHART_TOOLS` | `models/chart-config.interface.ts` | [features.md](../components/features.md#composed-chart) |
| Custom hooks | `hooks/use-*.ts(x)` | [components/overview.md](../components/overview.md) |

---

## Related Documentation
- [Documentation Index](../README.md)
- [Architecture Overview](../architecture/overview.md)
- [API Overview](../api/overview.md)
