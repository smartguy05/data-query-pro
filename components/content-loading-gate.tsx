"use client"

import { usePathname } from "next/navigation"
import { useDatabaseOptions } from "@/lib/database-connection-options"
import { Loader2 } from "lucide-react"

// Pages that don't need to wait for database context initialization
const UNGATED_PATHS = ["/landing", "/auth/login"]

export function ContentLoadingGate({ children }: { children: React.ReactNode }) {
  const { isInitialized } = useDatabaseOptions()
  const pathname = usePathname()

  if (!isInitialized && !UNGATED_PATHS.some(p => pathname.startsWith(p))) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
