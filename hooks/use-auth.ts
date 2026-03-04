"use client"

import { useEffect, useState, useCallback } from "react"

interface AuthUser {
  id: string
  email: string
  name: string | null
  image: string | null
}

interface AuthState {
  user: AuthUser | null
  isAdmin: boolean
  groups: string[]
  isAuthenticated: boolean
  isLoading: boolean
  authEnabled: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): AuthState {
  const [authEnabled, setAuthEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<{
    user: AuthUser | null
    isAdmin: boolean
    groups: string[]
  }>({ user: null, isAdmin: false, groups: [] })

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const authRes = await fetch("/api/config/auth-status")
        const authData = await authRes.json()

        if (cancelled) return

        if (!authData.authEnabled) {
          setAuthEnabled(false)
          setIsLoading(false)
          return
        }

        setAuthEnabled(true)

        // Dynamically import next-auth to get session
        const { getSession } = await import("next-auth/react")
        const sess = await getSession()

        if (cancelled) return

        if (sess?.user) {
          setSession({
            user: {
              id: sess.user.id || "",
              email: sess.user.email || "",
              name: sess.user.name || null,
              image: sess.user.image || null,
            },
            isAdmin: (sess as Record<string, unknown>).isAdmin === true,
            groups: ((sess as Record<string, unknown>).groups as string[]) || [],
          })
        }
      } catch {
        // Auth not available
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  const signIn = useCallback(async () => {
    const { signIn: authSignIn } = await import("next-auth/react")
    authSignIn("authentik", { callbackUrl: "/" })
  }, [])

  const signOut = useCallback(async () => {
    const { signOut: authSignOut } = await import("next-auth/react")
    authSignOut({ callbackUrl: "/auth/login" })
  }, [])

  return {
    user: session.user,
    isAdmin: session.isAdmin,
    groups: session.groups,
    isAuthenticated: !!session.user,
    isLoading,
    authEnabled,
    signIn,
    signOut,
  }
}
