"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Key, CheckCircle2, AlertCircle } from "lucide-react";
import { useOpenAIKey } from "@/hooks/use-openai-key";
import { ApiKeyDialog } from "./api-key-dialog";

/**
 * Component that shows the current API key status in the navigation
 * and allows users to manage their OpenAI API key.
 * Only renders when rate limiting is enabled on the server.
 */
export function ApiKeyIndicator() {
  const { apiKey, hasApiKey, clearApiKey, setApiKey, isLoaded } = useOpenAIKey();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rateLimitEnabled, setRateLimitEnabled] = useState<boolean | null>(null);

  // Check if rate limiting is enabled on mount
  useEffect(() => {
    fetch("/api/config/rate-limit-status")
      .then((res) => res.json())
      .then((data) => setRateLimitEnabled(data.rateLimitEnabled))
      .catch(() => setRateLimitEnabled(false));
  }, []);

  // Don't render if rate limiting is disabled or status is loading
  if (rateLimitEnabled === null || !rateLimitEnabled) {
    return null;
  }

  if (!isLoaded) {
    return null; // Don't render until API key status loaded
  }

  const handleSubmit = (newKey: string) => {
    setApiKey(newKey);
    setDialogOpen(false);
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
          >
            <Key className="h-4 w-4" />
            {hasApiKey ? (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            ) : (
              <AlertCircle className="h-3 w-3 text-yellow-500" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-3">
            <div className="space-y-1">
              <h4 className="font-medium leading-none">OpenAI API Key</h4>
              <p className="text-sm text-muted-foreground">
                {hasApiKey
                  ? "You have configured your own API key"
                  : "Using demo rate-limited access"}
              </p>
            </div>

            {hasApiKey ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-muted-foreground">
                    Key: {apiKey?.substring(0, 10)}...
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearApiKey}
                  className="w-full"
                >
                  Clear API Key
                </Button>
                <p className="text-xs text-muted-foreground">
                  After clearing, you'll use demo access with rate limits
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <span className="text-muted-foreground">
                    Demo access active
                  </span>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                  className="w-full"
                >
                  Add Your API Key
                </Button>
                <p className="text-xs text-muted-foreground">
                  Bypass rate limits by adding your own OpenAI API key
                </p>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <ApiKeyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
    </>
  );
}
