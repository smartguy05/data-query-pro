import type { NextAuthConfig } from 'next-auth';
import {
  isAuthEnabled,
  getProviderId,
  getProviderName,
  getScopes,
  getAdminSpec,
  getAllowedGroupsSpec,
} from './config';
import {
  resolveEmail,
  resolveName,
  extractClaimIdentities,
  hasGroupsOverage,
  matchesAdmin,
  isSignInAllowed,
  type OidcProfileClaims,
} from './oidc-profile';

function getAuthOptions(): NextAuthConfig {
  if (!isAuthEnabled()) {
    return {
      providers: [],
      callbacks: {},
    };
  }

  return {
    // next-auth v5 (5.0.0-beta.30) does not honor the AUTH_TRUST_HOST env var,
    // so deployments behind a reverse proxy must set this explicitly or
    // authorize/callback URLs get built for the internal 0.0.0.0:3000 host.
    trustHost: true,
    providers: [
      {
        id: getProviderId(),
        name: getProviderName(),
        type: 'oidc',
        issuer: process.env.AUTH_OIDC_ISSUER,
        clientId: process.env.AUTH_OIDC_CLIENT_ID,
        clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET,
        authorization: {
          params: {
            scope: getScopes(),
          },
        },
        profile(profile) {
          return {
            id: profile.sub,
            // Entra often omits `email` and carries the UPN in
            // `preferred_username`; see lib/auth/oidc-profile.ts.
            name: resolveName(profile as OidcProfileClaims),
            email: resolveEmail(profile as OidcProfileClaims),
            image: profile.picture,
          };
        },
      },
    ],
    session: {
      strategy: 'jwt',
    },
    pages: {
      signIn: '/auth/login',
      error: '/auth/error',
    },
    callbacks: {
      async signIn({ profile }) {
        const allowedSpec = getAllowedGroupsSpec();
        if (!allowedSpec) return true;

        const claims = (profile ?? {}) as OidcProfileClaims;
        const identities = extractClaimIdentities(claims);
        if (isSignInAllowed(identities, allowedSpec)) return true;

        const who =
          resolveEmail(claims) || (typeof claims.sub === 'string' ? claims.sub : '<unknown>');
        if (hasGroupsOverage(claims)) {
          console.warn(
            `[auth] Sign-in denied for ${who}: AUTH_ALLOWED_GROUPS is set, but the identity ` +
              'provider reported a groups overage (_claim_names/_claim_sources), so group ' +
              'membership could not be read and the gate fails closed. Use an Entra App Role ' +
              '(the `roles` claim, never subject to overage) in AUTH_ALLOWED_GROUPS instead.'
          );
        } else {
          console.warn(
            `[auth] Sign-in denied for ${who}: none of [${identities.join(', ')}] ` +
              'match AUTH_ALLOWED_GROUPS.'
          );
        }
        // false -> Auth.js throws AccessDenied and redirects to
        // /auth/error?error=AccessDenied (pages.error above).
        return false;
      },
      async jwt({ token, profile, account }) {
        if (account && profile) {
          const claims = profile as OidcProfileClaims;
          const email = resolveEmail(claims);
          const name = resolveName(claims);

          token.sub = profile.sub ?? undefined;
          token.email = email;
          token.name = name ?? undefined;

          // Merge `groups` (Authentik names / Entra GUIDs) with `roles` (Entra
          // App Roles) so one AUTH_ADMIN_GROUP value works on either provider.
          const groups = extractClaimIdentities(claims);
          token.groups = groups;
          token.isAdmin = matchesAdmin(groups, getAdminSpec());

          if (hasGroupsOverage(claims)) {
            console.warn(
              '[auth] Identity provider reported a groups overage (_claim_names/_claim_sources) ' +
                'instead of a groups claim, so no group membership could be read. This user will ' +
                'not receive admin rights or any group-based server-connection assignments. ' +
                'Resolving it requires a Microsoft Graph lookup, which this app does not perform — ' +
                'use an App Role (the `roles` claim) for admin instead, as roles are never subject ' +
                'to overage.'
            );
          }

          // Upsert user in app database
          try {
            const { upsertUser } = await import('@/lib/db/repositories/user-repository');
            const user = await upsertUser({
              oidcId: profile.sub as string,
              email,
              name: name ?? undefined,
              groups,
              isAdmin: token.isAdmin as boolean,
            });
            token.userId = user.id;
          } catch (error) {
            // users.email is NOT NULL, so an identity provider that sends neither
            // `email` nor `preferred_username` nor `upn` lands here. Without
            // token.userId the session looks signed in but every /api/data/* route
            // fails, so name the cause rather than logging a bare error.
            console.error(
              `[auth] Failed to upsert user (oidcId=${profile.sub}, resolved email=${
                email || '<empty>'
              }). The session will have no userId and authenticated API routes will fail. ` +
                'If the email is empty, the identity provider sent no email/preferred_username/upn claim.',
              error
            );
          }
        }

        // If userId is missing (e.g. upsert failed on initial login), try to resolve it
        if (!token.userId && token.sub) {
          try {
            const { getUserByOidcId, upsertUser } = await import('@/lib/db/repositories/user-repository');
            let user = await getUserByOidcId(token.sub);
            if (!user) {
              // Recovery path: the claims are already normalized onto the token by
              // the branch above, so reuse them rather than re-reading raw claims.
              user = await upsertUser({
                oidcId: token.sub,
                email: token.email as string || '',
                name: token.name as string || undefined,
                groups: (token.groups as string[]) || [],
                isAdmin: token.isAdmin === true,
              });
            }
            token.userId = user.id;
          } catch {
            // DB may not be ready yet, will retry on next request
          }
        }

        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.userId as string;
          (session as unknown as Record<string, unknown>).isAdmin = token.isAdmin;
          (session as unknown as Record<string, unknown>).groups = token.groups;
        }
        return session;
      },
    },
  };
}

export const authOptions = getAuthOptions();
