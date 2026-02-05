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
