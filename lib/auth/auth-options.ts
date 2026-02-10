import type { NextAuthConfig } from 'next-auth';
import { isAuthEnabled } from './config';

function getAuthOptions(): NextAuthConfig {
  if (!isAuthEnabled()) {
    return {
      providers: [],
      callbacks: {},
    };
  }

  return {
    providers: [
      {
        id: 'authentik',
        name: 'Authentik',
        type: 'oidc',
        issuer: process.env.AUTH_OIDC_ISSUER,
        clientId: process.env.AUTH_OIDC_CLIENT_ID,
        clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET,
        authorization: {
          params: {
            scope: 'openid email profile groups',
          },
        },
        profile(profile) {
          return {
            id: profile.sub,
            name: profile.name || profile.preferred_username,
            email: profile.email,
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
    },
    callbacks: {
      async jwt({ token, profile, account }) {
        if (account && profile) {
          token.sub = profile.sub;
          token.email = profile.email as string;
          token.name = (profile.name || profile.preferred_username) as string;

          // Extract groups from Authentik profile
          const groups = (profile.groups as string[]) || [];
          token.groups = groups;

          // Check admin status
          const adminGroup = process.env.AUTH_ADMIN_GROUP || 'dataquery-admins';
          token.isAdmin = groups.includes(adminGroup);

          // Upsert user in app database
          try {
            const { upsertUser } = await import('@/lib/db/repositories/user-repository');
            const user = await upsertUser({
              oidcId: profile.sub as string,
              email: profile.email as string,
              name: (profile.name || profile.preferred_username) as string,
              groups,
              isAdmin: token.isAdmin as boolean,
            });
            token.userId = user.id;
          } catch (error) {
            console.error('Failed to upsert user:', error);
          }
        }

        // If userId is missing (e.g. upsert failed on initial login), try to resolve it
        if (!token.userId && token.sub) {
          try {
            const { getUserByOidcId, upsertUser } = await import('@/lib/db/repositories/user-repository');
            let user = await getUserByOidcId(token.sub);
            if (!user) {
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
          (session as Record<string, unknown>).isAdmin = token.isAdmin;
          (session as Record<string, unknown>).groups = token.groups;
        }
        return session;
      },
    },
  };
}

export const authOptions = getAuthOptions();
