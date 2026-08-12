export function isAuthEnabled(): boolean {
  return !!(
    process.env.AUTH_OIDC_ISSUER &&
    process.env.AUTH_OIDC_CLIENT_ID &&
    process.env.AUTH_OIDC_CLIENT_SECRET
  );
}

/**
 * Provider-neutral OIDC configuration.
 *
 * Every default below reproduces the original Authentik-only behavior, so an
 * existing deployment upgrades without touching its env file.
 */

/** Fallbacks are exported so tests and docs cannot drift from the code. */
export const DEFAULT_PROVIDER_ID = 'authentik';
export const DEFAULT_PROVIDER_NAME = 'Authentik';
export const DEFAULT_OIDC_SCOPES = 'openid email profile groups';
export const DEFAULT_ADMIN_GROUP = 'dataquery-admins';

function envOrDefault(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

/**
 * Auth.js provider id. This is part of the callback URL
 * (`/api/auth/callback/<id>`), so it defaults to `authentik` to keep every
 * already-registered redirect URI valid. Changing it requires re-registering the
 * redirect URI at the identity provider.
 */
export function getProviderId(): string {
  return envOrDefault('AUTH_OIDC_PROVIDER_ID', DEFAULT_PROVIDER_ID);
}

/** Display name, shown on the sign-in button. */
export function getProviderName(): string {
  return envOrDefault('AUTH_OIDC_PROVIDER_NAME', DEFAULT_PROVIDER_NAME);
}

/**
 * Space-separated scopes. The default requests Authentik's custom `groups`
 * scope; Entra has no such scope and must be configured with
 * `AUTH_OIDC_SCOPES="openid email profile"` — it emits group/role claims via the
 * app registration's optional claims instead.
 */
export function getScopes(): string {
  return envOrDefault('AUTH_OIDC_SCOPES', DEFAULT_OIDC_SCOPES);
}

/**
 * Comma-separated list of group names, group object IDs, or App Role values that
 * grant admin. Compared case-insensitively against the merged `groups`+`roles`
 * claims.
 */
export function getAdminSpec(): string {
  return envOrDefault('AUTH_ADMIN_GROUP', DEFAULT_ADMIN_GROUP);
}
