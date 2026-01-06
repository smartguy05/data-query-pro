/**
 * Custom hook for tracking unsaved changes and warning users before leaving.
 *
 * Provides:
 * - State tracking for unsaved changes
 * - beforeunload event handler to warn users
 * - Utility to mark changes as saved
 */

import { useState, useEffect, useCallback } from "react";

export interface UseUnsavedChangesOptions {
  /** Initial unsaved state. Default: false */
  initialState?: boolean;
  /** Message to show in browser's beforeunload dialog (browsers may override) */
  message?: string;
}

export interface UseUnsavedChangesResult {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Set the unsaved changes state */
  setHasUnsavedChanges: (value: boolean) => void;
  /** Mark changes as saved (sets hasUnsavedChanges to false) */
  markAsSaved: () => void;
  /** Mark that changes exist (sets hasUnsavedChanges to true) */
  markAsUnsaved: () => void;
}

/**
 * Hook for tracking unsaved changes and warning users before leaving.
 *
 * Automatically adds/removes a beforeunload event listener that warns users
 * when they try to close or navigate away from the page with unsaved changes.
 *
 * @param options - Configuration options
 * @returns Object with unsaved changes state and utilities
 *
 * @example
 * const { hasUnsavedChanges, markAsUnsaved, markAsSaved } = useUnsavedChanges();
 *
 * // When user makes a change:
 * markAsUnsaved();
 *
 * // When user saves:
 * await saveData();
 * markAsSaved();
 */
export function useUnsavedChanges(
  options: UseUnsavedChangesOptions = {}
): UseUnsavedChangesResult {
  const { initialState = false } = options;

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(initialState);

  // Navigation guard for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        // Modern browsers ignore custom messages but still show a generic warning
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const markAsSaved = useCallback(() => {
    setHasUnsavedChanges(false);
  }, []);

  const markAsUnsaved = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  return {
    hasUnsavedChanges,
    setHasUnsavedChanges,
    markAsSaved,
    markAsUnsaved,
  };
}
