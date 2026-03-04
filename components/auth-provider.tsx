"use client"

import { SessionProvider } from "next-auth/react"
import { ReactNode, useEffect, useState } from "react"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    fetch("/api/config/auth-status")
      .then(res => res.json())
      .then(data => setAuthEnabled(data.authEnabled === true))
      .catch(() => setAuthEnabled(false))
  }, [])

  // While checking auth status, render children without session provider
  if (authEnabled === null || !authEnabled) {
    return <>{children}</>
  }

  return <SessionProvider>{children}</SessionProvider>
}
