"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AIOperationBannerProps {
  isVisible: boolean
  message?: string
  onDismiss?: () => void
  className?: string
}

/**
 * Banner component for displaying long-running AI operations
 * Shows a dismissible alert with a loading spinner and custom message
 */
export function AIOperationBanner({
  isVisible,
  message = "AI processing in progress. This may take a moment...",
  onDismiss,
  className,
}: AIOperationBannerProps) {
  if (!isVisible) return null

  return (
    <Alert className={cn("border-blue-500 bg-blue-50 dark:bg-blue-950/30", className)}>
      <div className="flex items-start gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                <span>{message}</span>
              </div>
            </AlertDescription>
            {onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                onClick={onDismiss}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Dismiss</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Alert>
  )
}
