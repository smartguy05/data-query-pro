"use client";

import { useState, useCallback } from "react";
import { useOpenAIKey } from "./use-openai-key";

/**
 * Hook that provides a fetch function with automatic API key injection
 * and 429 rate limit error detection
 *
 * Returns:
 * - fetchWithAuth: fetch function that includes auth headers
 * - showRateLimitDialog: boolean indicating if rate limit dialog should be shown
 * - resetTimeInfo: reset time for rate limit
 * - clearRateLimitError: function to clear the rate limit error state
 */
export function useOpenAIFetch() {
  const { getAuthHeaders } = useOpenAIKey();
  const [showRateLimitDialog, setShowRateLimitDialog] = useState(false);
  const [resetTimeInfo, setResetTimeInfo] = useState<number | undefined>();

  /**
   * Enhanced fetch that automatically includes user's API key
   */
  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers = {
        ...options.headers,
        ...getAuthHeaders(),
      };

      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Check for rate limit error
      if (response.status === 429) {
        try {
          // Clone the response so we can read it
          const clonedResponse = response.clone();
          const errorData = await clonedResponse.json();

          if (errorData.error === "RATE_LIMIT_EXCEEDED") {
            setResetTimeInfo(errorData.resetTime);
            setShowRateLimitDialog(true);
          }
        } catch (e) {
          // If we can't parse the error, just show the dialog
          setShowRateLimitDialog(true);
        }
      }

      return response;
    },
    [getAuthHeaders]
  );

  const clearRateLimitError = useCallback(() => {
    setShowRateLimitDialog(false);
    setResetTimeInfo(undefined);
  }, []);

  return {
    fetchWithAuth,
    showRateLimitDialog,
    resetTimeInfo,
    clearRateLimitError,
  };
}
