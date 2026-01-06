"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "user_openai_key";

/**
 * Hook to manage user's OpenAI API key in sessionStorage
 * The key is stored only in the browser's session storage and is never persisted to the server
 */
export function useOpenAIKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load the API key from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedKey = sessionStorage.getItem(STORAGE_KEY);
      setApiKeyState(storedKey);
      setIsLoaded(true);
    }
  }, []);

  /**
   * Save a new API key to sessionStorage
   */
  const setApiKey = (key: string | null) => {
    if (typeof window !== "undefined") {
      if (key) {
        sessionStorage.setItem(STORAGE_KEY, key);
        setApiKeyState(key);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
        setApiKeyState(null);
      }
    }
  };

  /**
   * Clear the stored API key
   */
  const clearApiKey = () => {
    setApiKey(null);
  };

  /**
   * Check if user has provided an API key
   */
  const hasApiKey = (): boolean => {
    return !!apiKey && apiKey.length > 0;
  };

  /**
   * Get headers to include the user's API key in requests
   * Returns an object that can be spread into fetch headers
   *
   * Note: Reads from sessionStorage directly as a fallback to handle
   * the case where the key was just set but React state hasn't updated yet
   */
  const getAuthHeaders = (): Record<string, string> => {
    // Check React state first, but fall back to sessionStorage for immediate updates
    let key = apiKey;
    if (!key && typeof window !== "undefined") {
      key = sessionStorage.getItem(STORAGE_KEY);
    }

    if (key && key.length > 0) {
      return {
        "x-user-openai-key": key,
      };
    }
    return {};
  };

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
      ...getAuthHeaders(),
    };

    return fetch(url, {
      ...options,
      headers,
    });
  };

  return {
    apiKey,
    setApiKey,
    clearApiKey,
    hasApiKey: hasApiKey(),
    isLoaded,
    getAuthHeaders,
    fetchWithKey,
  };
}
