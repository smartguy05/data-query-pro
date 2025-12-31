import { Suspense } from "react";
import { LoginContent } from "./login-content";
import { Loader2 } from "lucide-react";

// Force dynamic rendering to prevent static generation
export const dynamic = "force-dynamic";

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginContent />
    </Suspense>
  );
}
