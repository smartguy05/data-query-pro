"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

const STORAGE_KEY = "user_openai_key";

interface OpenAIApiContextType {
  apiKey: string | null;
  setApiKey: (key: string | null) => void;
  clearApiKey: () => void;
  hasApiKey: boolean;
  isLoaded: boolean;
  getAuthHeaders: () => Record<string, string>;
}

const OpenAIApiContext = createContext<OpenAIApiContextType | undefined>(undefined);

/**
 * Provider component that manages OpenAI API key state across the app.
 * The key is stored in sessionStorage and shared via React Context.
 */
export function OpenAIApiProvider({ children }: { children: ReactNode }) {
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

  // Listen for storage events from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setApiKeyState(e.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  /**
   * Save a new API key to sessionStorage
   */
  const setApiKey = useCallback((key: string | null) => {
    if (typeof window !== "undefined") {
      if (key) {
        sessionStorage.setItem(STORAGE_KEY, key);
        setApiKeyState(key);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
        setApiKeyState(null);
      }
    }
  }, []);

  /**
   * Clear the stored API key
   */
  const clearApiKey = useCallback(() => {
    setApiKey(null);
  }, [setApiKey]);

  /**
   * Get headers to include the user's API key in requests
   */
  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (apiKey && apiKey.length > 0) {
      return {
        "x-user-openai-key": apiKey,
      };
    }
    return {};
  }, [apiKey]);

  const value: OpenAIApiContextType = {
    apiKey,
    setApiKey,
    clearApiKey,
    hasApiKey: !!apiKey && apiKey.length > 0,
    isLoaded,
    getAuthHeaders,
  };

  return (
    <OpenAIApiContext.Provider value={value}>
      {children}
    </OpenAIApiContext.Provider>
  );
}

/**
 * Hook to access the OpenAI API key context.
 * Must be used within an OpenAIApiProvider.
 */
export function useOpenAIApiContext() {
  const context = useContext(OpenAIApiContext);
  if (context === undefined) {
    throw new Error("useOpenAIApiContext must be used within an OpenAIApiProvider");
  }
  return context;
}
