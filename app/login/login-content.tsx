"use client";

/**
 * Login Content Component
 *
 * Client component that displays Azure SSO login button for multi-user mode.
 * Redirects to home if already authenticated or if multi-user mode is disabled.
 */

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Database, LogIn, AlertCircle, Loader2 } from "lucide-react";

export function LoginContent() {
  const sessionResult = useSession();
  const session = sessionResult?.data;
  const status = sessionResult?.status ?? "loading";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  // Check if multi-user mode is enabled
  const multiUserEnabled = process.env.NEXT_PUBLIC_MULTI_USER_ENABLED === "true";

  // Mark as mounted after initial render
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (mounted && status === "authenticated") {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl, mounted]);

  // Redirect to home if multi-user mode is disabled
  useEffect(() => {
    if (mounted && !multiUserEnabled) {
      router.push("/");
    }
  }, [multiUserEnabled, router, mounted]);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("azure-ad", { callbackUrl });
    } catch (err) {
      console.error("Sign in error:", err);
      setIsLoading(false);
    }
  };

  // Show loading while checking session or not yet mounted
  if (!mounted || status === "loading" || !multiUserEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Get error message
  const getErrorMessage = (errorCode: string | null): string | null => {
    switch (errorCode) {
      case "AccessDenied":
        return "Access denied. Only @oneflight.net email addresses are allowed.";
      case "Configuration":
        return "Authentication is not properly configured. Please contact an administrator.";
      case "OAuthSignin":
      case "OAuthCallback":
        return "An error occurred during sign in. Please try again.";
      default:
        return errorCode ? `Authentication error: ${errorCode}` : null;
    }
  };

  const errorMessage = getErrorMessage(error);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Database className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">DataQuery Pro</CardTitle>
          <CardDescription>
            Sign in with your organization account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign in with Microsoft
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Only @oneflight.net accounts are permitted to sign in.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
