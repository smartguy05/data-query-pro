/**
 * NextAuth.js Configuration
 *
 * Configures Azure AD authentication for multi-user mode.
 * When MULTI_USER_ENABLED is false, authentication is bypassed.
 */

import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { getServerStorageService, isMultiUserEnabled } from "@/lib/services/storage";

// Azure AD configuration from environment
const AZURE_AD_CLIENT_ID = process.env.AZURE_AD_CLIENT_ID || "";
const AZURE_AD_CLIENT_SECRET = process.env.AZURE_AD_CLIENT_SECRET || "";
const AZURE_AD_TENANT_ID = process.env.AZURE_AD_TENANT_ID || "";
const ALLOWED_DOMAIN = "oneflight.net";

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: AZURE_AD_CLIENT_ID,
      clientSecret: AZURE_AD_CLIENT_SECRET,
      tenantId: AZURE_AD_TENANT_ID,
      authorization: {
        params: {
          scope: "openid email profile User.Read",
        },
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      // Only allow sign in when multi-user mode is enabled
      if (!isMultiUserEnabled()) {
        console.warn("Sign in attempted but multi-user mode is disabled");
        return false;
      }

      // Verify email domain
      const email = user.email?.toLowerCase();
      if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        console.warn(`Sign in rejected for non-${ALLOWED_DOMAIN} email: ${email}`);
        return false;
      }

      try {
        const storage = getServerStorageService();

        // Check if user exists
        let dbUser = await storage.users.getUserByEmail(email);

        if (!dbUser) {
          // Check if this is the first user (will be admin)
          const isFirst = await storage.users.isFirstUser();

          // Create new user
          dbUser = await storage.users.createUser({
            email,
            name: user.name || email.split("@")[0],
            azureOid: (profile as { oid?: string })?.oid,
            role: isFirst ? "admin" : "user",
            createdAt: new Date().toISOString(),
          });

          console.log(`Created new ${isFirst ? "admin" : ""} user: ${email}`);
        } else {
          // Update last login
          await storage.users.updateUser(dbUser.id, {
            lastLogin: new Date().toISOString(),
            azureOid: (profile as { oid?: string })?.oid || dbUser.azureOid,
          });
        }

        return true;
      } catch (error) {
        console.error("Error during sign in:", error);
        return false;
      }
    },

    async jwt({ token, user, account, profile }) {
      // On initial sign in, fetch user from database
      if (account && user?.email) {
        try {
          const storage = getServerStorageService();
          const dbUser = await storage.users.getUserByEmail(user.email);

          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
          }
        } catch (error) {
          console.error("Error fetching user for JWT:", error);
        }
      }

      return token;
    },

    async session({ session, token }) {
      // Add user ID and role to session
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "user";
      }

      return session;
    },
  },

  events: {
    async signOut({ token }) {
      // Optional: Log sign out events
      console.log(`User signed out: ${token.email}`);
    },
  },

  debug: process.env.NODE_ENV === "development",
};

/**
 * Helper to check if the current request is authenticated
 * For use in API routes
 */
export async function getServerSession() {
  // Dynamic import to avoid issues with next-auth initialization
  const { getServerSession: nextAuthGetServerSession } = await import("next-auth");
  return nextAuthGetServerSession(authOptions);
}

/**
 * Helper to check if authentication is required
 * Returns false when multi-user mode is disabled
 */
export function isAuthRequired(): boolean {
  return isMultiUserEnabled();
}
