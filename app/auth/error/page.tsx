import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ShieldX, LogIn } from "lucide-react"

// Auth.js redirects here (pages.error) with ?error=<code>. AccessDenied is the
// only code our signIn callback produces, so it maps to the AUTH_ALLOWED_GROUPS
// denial; everything else gets a generic message.
const MESSAGES: Record<string, { title: string; body: string }> = {
  AccessDenied: {
    title: "Access denied",
    body:
      "Your account is not a member of a group that is allowed to use this application. " +
      "Contact your administrator if you believe this is a mistake.",
  },
  Configuration: {
    title: "Sign-in unavailable",
    body: "There is a problem with the authentication configuration. Contact your administrator.",
  },
}

const FALLBACK = {
  title: "Sign-in error",
  body: "Something went wrong during sign-in. Please try again.",
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const message = MESSAGES[error ?? ""] ?? FALLBACK

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-sm w-full mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg shadow-red-500/20 mb-4">
            <ShieldX className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">DataQuery Pro</h1>
          <p className="text-muted-foreground mt-1">{message.title}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <p className="text-sm text-foreground text-center">{message.body}</p>
          <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-6" size="lg">
            <Link href="/auth/login">
              <LogIn className="h-4 w-4 mr-2" />
              Back to sign in
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
