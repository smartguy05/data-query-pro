/**
 * Custom hook for schema introspection with polling support.
 *
 * Handles the async schema loading process including:
 * - Starting introspection
 * - Polling for completion status
 * - Managing loading states
 * - Error handling
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Schema } from "@/models/schema.interface";

/** Default polling interval in milliseconds */
const DEFAULT_POLL_INTERVAL = 2000;

export interface SchemaLoadingState {
  /** Whether schema is currently loading */
  isLoading: boolean;
  /** Whether a background process is running */
  isProcessing: boolean;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current status message */
  message: string;
  /** Error message if loading failed */
  error: string | null;
}

export interface UseSchemaLoadingOptions {
  /** Callback when schema loading completes successfully */
  onComplete?: (schema: Schema) => void;
  /** Callback when schema loading fails */
  onError?: (error: string) => void;
  /** Polling interval in ms. Default: 2000 */
  pollInterval?: number;
}

export interface UseSchemaLoadingResult extends SchemaLoadingState {
  /** Start the schema introspection process */
  startIntrospection: (connectionId: string, connectionData: unknown) => Promise<void>;
  /** Reset all loading states */
  reset: () => void;
  /** Clear error state */
  clearError: () => void;
  /** Update loading states (for external sync) */
  setLoadingStates: (states: Partial<SchemaLoadingState>) => void;
}

const initialState: SchemaLoadingState = {
  isLoading: false,
  isProcessing: false,
  progress: 0,
  message: "",
  error: null,
};

/**
 * Hook for managing schema introspection with polling.
 *
 * @param options - Configuration options
 * @returns Object with loading state and control functions
 *
 * @example
 * const {
 *   isLoading,
 *   isProcessing,
 *   progress,
 *   message,
 *   error,
 *   startIntrospection
 * } = useSchemaLoading({
 *   onComplete: (schema) => saveSchema(schema),
 *   onError: (err) => showError(err)
 * });
 */
export function useSchemaLoading(
  options: UseSchemaLoadingOptions = {}
): UseSchemaLoadingResult {
  const { onComplete, onError, pollInterval = DEFAULT_POLL_INTERVAL } = options;

  const [state, setState] = useState<SchemaLoadingState>(initialState);
  const [processId, setProcessId] = useState<string | null>(null);

  // Use refs to access latest callbacks without re-running effect
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  // Polling effect for background process
  useEffect(() => {
    if (!processId || !state.isProcessing) {
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/schema/status?processId=${processId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch status");
        }

        const status = await response.json();
        setState((prev) => ({
          ...prev,
          progress: status.progress,
          message: status.message,
        }));

        if (status.status === "completed") {
          setState({
            isLoading: false,
            isProcessing: false,
            progress: 100,
            message: "Schema introspection completed",
            error: null,
          });
          setProcessId(null);

          if (status.result?.schema && onCompleteRef.current) {
            onCompleteRef.current(status.result.schema);
          }
        } else if (status.status === "error") {
          const errorMessage = status.error || "Schema introspection failed";
          setState({
            isLoading: false,
            isProcessing: false,
            progress: 0,
            message: "",
            error: errorMessage,
          });
          setProcessId(null);

          if (onErrorRef.current) {
            onErrorRef.current(errorMessage);
          }
        }
      } catch (err) {
        console.error("Error polling status:", err);
      }
    };

    const intervalId = setInterval(pollStatus, pollInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [processId, state.isProcessing, pollInterval]);

  const startIntrospection = useCallback(
    async (connectionId: string, connectionData: unknown) => {
      setState({
        isLoading: true,
        isProcessing: true,
        progress: 0,
        message: "Starting schema introspection...",
        error: null,
      });

      try {
        const response = await fetch("/api/schema/start-introspection", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ connection: connectionData }),
        });

        if (!response.ok) {
          throw new Error("Failed to start introspection");
        }

        const data = await response.json();

        if (data.processId) {
          // Async process started, polling will handle completion
          setProcessId(data.processId);
        } else if (data.schema) {
          // Synchronous completion
          setState({
            isLoading: false,
            isProcessing: false,
            progress: 100,
            message: "Schema introspection completed",
            error: null,
          });

          const schema: Schema = {
            connectionId,
            tables: data.schema.tables,
          };

          if (onCompleteRef.current) {
            onCompleteRef.current(schema);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to start introspection";
        setState({
          isLoading: false,
          isProcessing: false,
          progress: 0,
          message: "",
          error: errorMessage,
        });

        if (onErrorRef.current) {
          onErrorRef.current(errorMessage);
        }
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState(initialState);
    setProcessId(null);
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const setLoadingStates = useCallback((states: Partial<SchemaLoadingState>) => {
    setState((prev) => ({ ...prev, ...states }));
  }, []);

  return {
    ...state,
    startIntrospection,
    reset,
    clearError,
    setLoadingStates,
  };
}
