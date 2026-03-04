"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Database, LogIn } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // If auth is not enabled, redirect to home
    fetch("/api/config/auth-status")
      .then(res => res.json())
      .then(data => {
        if (!data.authEnabled) {
          router.replace("/")
        }
      })
      .catch(() => router.replace("/"))
  }, [router])

  const handleSignIn = async () => {
    const { signIn } = await import("next-auth/react")
    signIn("authentik", { callbackUrl: "/" })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-sm w-full mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/20 mb-4">
            <Database className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">DataQuery Pro</h1>
          <p className="text-muted-foreground mt-1">Sign in to continue</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <Button
            onClick={handleSignIn}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            <LogIn className="h-4 w-4 mr-2" />
            Sign in with Authentik
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-4">
            You will be redirected to your organization&apos;s identity provider.
          </p>
        </div>
      </div>
    </div>
  )
}
