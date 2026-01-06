"use client";

import { useOpenAIApiContext } from "@/components/openai-api-provider";

/**
 * Hook to manage user's OpenAI API key.
 *
 * This hook provides access to the shared API key state managed by OpenAIApiProvider.
 * The key is stored in sessionStorage and shared across all components.
 */
export function useOpenAIKey() {
  const context = useOpenAIApiContext();

  /**
   * Enhanced fetch function that automatically includes the user's API key
   * Use this instead of regular fetch for OpenAI API requests
   */
  const fetchWithKey = async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const headers = {
      ...options.headers,
      ...context.getAuthHeaders(),
    };

    return fetch(url, {
      ...options,
      headers,
    });
  };

  return {
    apiKey: context.apiKey,
    setApiKey: context.setApiKey,
    clearApiKey: context.clearApiKey,
    hasApiKey: context.hasApiKey,
    isLoaded: context.isLoaded,
    getAuthHeaders: context.getAuthHeaders,
    fetchWithKey,
  };
}
