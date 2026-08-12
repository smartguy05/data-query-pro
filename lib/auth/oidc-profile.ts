/**
 * Provider-neutral mapping of OIDC ID-token claims.
 *
 * Authentik and Azure Entra ID describe the same concepts with different claims,
 * so every provider-specific assumption is isolated here as a pure function that
 * can be unit-tested without a live identity provider.
 *
 * The differences that matter:
 * - **Email**: Authentik sends `email`. Entra frequently omits it (it is only
 *   populated when the user has a mail attribute) and carries the UPN in
 *   `preferred_username` instead. `users.email` is NOT NULL, so an unresolved
 *   email breaks the upsert and leaves the session without a `userId`.
 * - **Group membership**: Authentik sends group *names* in `groups`. Entra sends
 *   group object *GUIDs* in `groups`, and App Roles in a separate `roles` claim.
 *   Both are merged so one `AUTH_ADMIN_GROUP` value can be a name, a GUID, or a
 *   role.
 * - **Groups overage**: past a membership threshold Entra drops `groups` entirely
 *   and substitutes `_claim_names`/`_claim_sources`, which must be resolved via
 *   Microsoft Graph. We detect this and warn rather than silently granting nobody
 *   admin.
 */

/** Raw OIDC claims. Shape varies by provider, so everything is unknown. */
export type OidcProfileClaims = Record<string, unknown>;

/** Reads a claim as a trimmed non-empty string, or undefined. */
function stringClaim(profile: OidcProfileClaims, claim: string): string | undefined {
  const value = profile?.[claim];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Reads a claim as a string array. Accepts a bare string as a single entry. */
function stringArrayClaim(profile: OidcProfileClaims, claim: string): string[] {
  const value = profile?.[claim];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);
}

/**
 * Resolve the user's email address.
 *
 * Falls back through `preferred_username` and `upn` because Entra often omits
 * `email`. Returns '' only when the provider sent none of them — the caller must
 * treat that as fatal, since `users.email` is NOT NULL.
 */
export function resolveEmail(profile: OidcProfileClaims): string {
  return (
    stringClaim(profile, 'email') ??
    stringClaim(profile, 'preferred_username') ??
    stringClaim(profile, 'upn') ??
    ''
  );
}

/** Resolve a display name, falling back to the UPN-style username. */
export function resolveName(profile: OidcProfileClaims): string | null {
  return (
    stringClaim(profile, 'name') ??
    stringClaim(profile, 'preferred_username') ??
    null
  );
}

/**
 * Merge every claim that can identify a user's entitlements into one list:
 * `groups` (Authentik names / Entra GUIDs) plus `roles` (Entra App Roles).
 *
 * Order is preserved and duplicates removed, so the result is stable enough to
 * store on the JWT and in `users.groups`.
 */
export function extractClaimIdentities(profile: OidcProfileClaims): string[] {
  const merged = [...stringArrayClaim(profile, 'groups'), ...stringArrayClaim(profile, 'roles')];
  return Array.from(new Set(merged));
}

/**
 * Detect Entra's groups overage, where `groups` is replaced by pointers that only
 * Microsoft Graph can resolve. Without this, an affected user simply arrives with
 * no groups and silently gets no admin rights.
 */
export function hasGroupsOverage(profile: OidcProfileClaims): boolean {
  if (stringArrayClaim(profile, 'groups').length > 0) return false;

  const claimNames = profile?.['_claim_names'];
  if (claimNames && typeof claimNames === 'object' && 'groups' in claimNames) {
    return true;
  }

  const claimSources = profile?.['_claim_sources'];
  return !!claimSources && typeof claimSources === 'object';
}

/**
 * Does any of the user's identities match the configured admin spec?
 *
 * `adminSpec` is a comma-separated list so a single deployment can accept, say,
 * both an Authentik group name and an Entra App Role. Matching is
 * case-insensitive, which also makes GUID casing irrelevant.
 */
export function matchesAdmin(identities: string[], adminSpec: string | undefined): boolean {
  const wanted = (adminSpec ?? '')
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(entry => entry.length > 0);

  if (wanted.length === 0) return false;

  const held = new Set(identities.map(entry => entry.trim().toLowerCase()));
  return wanted.some(entry => held.has(entry));
}
