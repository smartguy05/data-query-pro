"use client";

import { ReactNode } from "react";

/**
 * Simple provider component - actual OpenAI integration is handled
 * through useOpenAIKey hook and individual components
 */
export function OpenAIApiProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
