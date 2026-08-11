# SSO / Multi-User Auth — Superseded

This file used to track a Dec 2025 plan to add multi-user support via a
**native Azure AD provider** — dedicated `AZURE_AD_CLIENT_ID` /
`AZURE_AD_CLIENT_SECRET` / `AZURE_AD_TENANT_ID` env vars, a
`lib/services/storage/*` abstraction, `app/login/*`, `app/admin/users/*`,
`types/next-auth.d.ts`, etc.

**That plan was abandoned.** None of the files it described exist in this
repo anymore.

## What actually shipped

A **generic OIDC provider** on Auth.js v5 (the provider's internal id is
hardcoded to `"authentik"`, but it works with any standards-compliant OIDC
identity provider — including Microsoft Entra ID). It's documented in:

- `lib/auth/auth-options.ts` / `lib/auth/config.ts` — the provider config
- `docs/architecture/auth-and-data-layer.md` — how it fits the storage layer
- `docs/guides/authentication-testing.md` — local Authentik test stack
- `docs/guides/deployment.md` — production env vars (`AUTH_OIDC_*`, `AUTH_SECRET`,
  `AUTH_URL`, `APP_DATABASE_URL`, `APP_ENCRYPTION_KEY`, …)

For enabling login against Entra ID specifically, use those docs rather than
anything that used to be below this line.

## Note (2026-08-11)

This file previously contained what appeared to be a real Azure AD Client ID,
Tenant ID, and an internal domain restriction tied to the abandoned plan
above. That content has been removed here, but it was already committed and
pushed to this public repo (commit `52324d2`) — rewriting this file does not
remove it from git history. If that old app registration is still live in
Entra, consider rotating or deleting it in the Entra admin center
independently of this doc; a history rewrite (e.g. `git filter-repo`) would
be a separate, more invasive step if the exposure needs to be scrubbed from
history too.
