# Azure Entra ID (Azure AD) Setup

DataQuery Pro's OIDC integration is provider-neutral. This guide covers configuring it
against **Microsoft Entra ID**; for Authentik see
[Authentication Testing](./authentication-testing.md).

Only environment variables differ — there is no per-provider code.

## 1. Register the application

In the Entra admin center → **App registrations** → **New registration**:

- **Redirect URI** (type *Web*): `https://<your-host>/api/auth/callback/authentik`

That path is not a typo. The Auth.js provider id defaults to `authentik` and forms the
callback URL. Registering it as-is is the zero-friction option. If the name bothers you, set
`AUTH_OIDC_PROVIDER_ID=entra` and register `/api/auth/callback/entra` instead — but note that
changing this on an existing deployment invalidates the previously registered URI.

Then create a **client secret** under *Certificates & secrets*.

## 2. Environment variables

```env
AUTH_OIDC_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
AUTH_OIDC_CLIENT_ID=<application-client-id>
AUTH_OIDC_CLIENT_SECRET=<client-secret-value>
AUTH_OIDC_PROVIDER_NAME=Microsoft
AUTH_OIDC_SCOPES=openid email profile

AUTH_SECRET=<openssl rand -hex 32>
AUTH_URL=https://<your-host>
AUTH_ADMIN_GROUP=<see below>

APP_DATABASE_URL=postgres://...
APP_ENCRYPTION_KEY=<openssl rand -hex 32>
```

**`AUTH_OIDC_SCOPES` is mandatory here.** The default includes Authentik's custom `groups`
scope, which Entra does not define and will reject. Entra emits group and role information
through the app registration's optional claims, not through a scope.

## 3. Choose how admins are identified

`AUTH_ADMIN_GROUP` is a comma-separated list matched case-insensitively against the merged
`groups` **and** `roles` claims, so any of these work.

### Option A — App Role (recommended)

Define an App Role (e.g. value `DataQuery.Admin`) in *App roles*, assign users or groups to
it under *Enterprise applications → Users and groups*, then:

```env
AUTH_ADMIN_GROUP=DataQuery.Admin
```

Roles arrive in the `roles` claim with no extra configuration and are **never subject to
groups overage** (see below), which makes this the most robust option.

### Option B — Security group

Under *Token configuration* → *Add groups claim*, select **Security groups** and ensure the
**ID token** is included. Entra emits group **object IDs**, not display names, so:

```env
AUTH_ADMIN_GROUP=8f4c1d2e-0000-4a1b-9c3d-111122223333
```

Copy the GUID from the group's Overview page. (Display names are only available for
on-premises-synced groups via `sAMAccountName`.)

To support both providers from one config, list both:

```env
AUTH_ADMIN_GROUP=dataquery-admins,DataQuery.Admin
```

## 4. Verify with a real token

Claim behavior varies by tenant, so confirm rather than assume. Sign in once, then decode the
ID token (Entra admin center → *Sign-in logs*, or jwt.ms) and check:

| Claim | What to confirm |
|---|---|
| `email` | Present? If absent, the app falls back to `preferred_username`, then `upn`. |
| `preferred_username` | Should hold the UPN. |
| `groups` | Present, and containing GUIDs? |
| `roles` | Present if you configured an App Role. |
| `_claim_names` / `_claim_sources` | If these appear **instead of** `groups`, you have overage. |

Set `AUTH_ADMIN_GROUP` from what the token actually contains.

## Gotchas

**Groups overage.** Past a membership threshold (~150 groups for an ID token) Entra omits the
`groups` claim entirely and substitutes `_claim_names`/`_claim_sources` pointing at Microsoft
Graph. This app does **not** perform that Graph lookup. Affected users arrive with no groups,
so they get no admin rights and no group-based server-connection assignments. The app logs an
explicit `[auth] Identity provider reported a groups overage ...` warning when it detects
this. **Use an App Role (Option A) to avoid it entirely.**

**Group changes need a re-login.** Claims are only read when the JWT is minted, on initial
sign-in. A user added to the admin group must sign out and back in.

**Missing email is fatal.** `users.email` is `NOT NULL`. If a token carries none of `email`,
`preferred_username`, or `upn`, the user upsert fails and the session ends up with no
`userId` — the user appears signed in while every `/api/data/*` call fails. The server log
will show `[auth] Failed to upsert user (... resolved email=<empty>)`. In practice Entra
always issues a UPN, so this should not occur.

**Sharing requires a prior login.** The share picker searches the app's `users` table, which
is only populated when someone signs in for the first time. People who exist in Entra but
have never logged in will not appear.

## Related

- [Authentication & Data Layer](../architecture/auth-and-data-layer.md) — claim mapping and
  storage internals
- [Authentication Testing](./authentication-testing.md) — local Authentik stack
