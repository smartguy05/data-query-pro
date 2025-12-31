"use client";

/**
 * Session Provider Component
 *
 * Wraps the application with NextAuth's SessionProvider for client-side
 * session access. Only renders the provider when multi-user mode is enabled.
 */

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface SessionProviderProps {
  children: ReactNode;
  multiUserEnabled: boolean;
}

export function SessionProvider({ children, multiUserEnabled }: SessionProviderProps) {
  // In single-user mode, skip the SessionProvider wrapper
  if (!multiUserEnabled) {
    return <>{children}</>;
  }

  return (
    <NextAuthSessionProvider
      // Refetch session every 5 minutes
      refetchInterval={5 * 60}
      // Refetch session when window is focused
      refetchOnWindowFocus={true}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
