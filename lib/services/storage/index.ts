/**
 * Storage Service Factory
 *
 * Returns the appropriate storage service based on the MULTI_USER_ENABLED environment variable.
 * - When disabled (default): Uses localStorage for all data persistence
 * - When enabled: Uses PostgreSQL for centralized data storage
 */

import { createLocalStorageService } from './local-storage.adapter';
import type { IStorageService } from './storage.interface';

// Re-export all types and interfaces
export * from './storage.interface';
export { createLocalStorageService } from './local-storage.adapter';

// Singleton instance cache (separate for client and server)
let clientStorageServiceInstance: IStorageService | null = null;
let serverStorageServiceInstance: IStorageService | null = null;

/**
 * Check if multi-user mode is enabled
 */
export function isMultiUserEnabled(): boolean {
  // Check for environment variable
  // In Next.js, client-side env vars must be prefixed with NEXT_PUBLIC_
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_MULTI_USER_ENABLED === 'true';
  }
  // Server-side can use the non-prefixed version
  return process.env.MULTI_USER_ENABLED === 'true';
}

/**
 * Check if we're running on the server
 */
function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Dynamically load the PostgreSQL adapter (server-side only)
 * Uses eval to prevent webpack from statically analyzing the require
 */
function loadPostgresAdapter(): IStorageService {
  // Use eval to hide require from webpack's static analysis
  // This is necessary because webpack bundles all require() calls even in conditional blocks
  // eslint-disable-next-line no-eval
  const dynamicRequire = eval('require');
  const { createPostgresStorageService } = dynamicRequire('./postgres.adapter');
  return createPostgresStorageService();
}

/**
 * Get the storage service instance (singleton pattern)
 *
 * This factory returns:
 * - localStorage adapter when MULTI_USER_ENABLED is not set or false
 * - PostgreSQL adapter when MULTI_USER_ENABLED is true AND running server-side
 * - localStorage adapter on client-side (even in multi-user mode, for now)
 *
 * Note: In multi-user mode, client-side components should use API routes
 * for data persistence. The localStorage adapter on client is a temporary
 * fallback until API routes are fully implemented in Phase 4.
 */
export function getStorageService(): IStorageService {
  const multiUserEnabled = isMultiUserEnabled();
  const onServer = isServer();

  // Server-side with multi-user mode: use PostgreSQL
  if (onServer && multiUserEnabled) {
    if (!serverStorageServiceInstance) {
      serverStorageServiceInstance = loadPostgresAdapter();
    }
    return serverStorageServiceInstance;
  }

  // Client-side or single-user mode: use localStorage
  if (!clientStorageServiceInstance) {
    clientStorageServiceInstance = createLocalStorageService();
  }
  return clientStorageServiceInstance;
}

/**
 * Get the server-side storage service directly
 * Only call this from API routes or server components
 */
export function getServerStorageService(): IStorageService {
  if (!isServer()) {
    throw new Error('getServerStorageService can only be called on the server');
  }

  if (isMultiUserEnabled()) {
    if (!serverStorageServiceInstance) {
      serverStorageServiceInstance = loadPostgresAdapter();
    }
    return serverStorageServiceInstance;
  }

  // Single-user mode on server still uses localStorage adapter
  // (though localStorage itself isn't available, the adapter handles this)
  if (!serverStorageServiceInstance) {
    serverStorageServiceInstance = createLocalStorageService();
  }
  return serverStorageServiceInstance;
}

/**
 * Reset the storage service instances
 * Useful for testing or when environment changes
 */
export function resetStorageService(): void {
  clientStorageServiceInstance = null;
  serverStorageServiceInstance = null;
}

/**
 * Create a React hook-friendly storage service getter
 * This ensures the storage service is only accessed on the client side
 */
export function useStorageService(): IStorageService {
  return getStorageService();
}
