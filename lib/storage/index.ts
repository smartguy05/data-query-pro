/**
 * Storage Module
 *
 * This module provides a centralized storage service for the application.
 *
 * Current Implementation: sessionStorage
 *
 * To migrate to a database backend in the future:
 * 1. Create a new adapter class that implements IStorageAdapter
 * 2. Make the adapter handle async operations (database calls)
 * 3. Update the StorageService to support async operations
 * 4. Replace SessionStorageAdapter with your database adapter
 *
 * Example database adapter structure:
 *
 * class DatabaseStorageAdapter implements IStorageAdapter {
 *   constructor(private apiClient: ApiClient) {}
 *
 *   async getItem(key: string): Promise<string | null> {
 *     const response = await this.apiClient.get(`/api/storage/${key}`)
 *     return response.data.value
 *   }
 *
 *   async setItem(key: string, value: string): Promise<void> {
 *     await this.apiClient.post(`/api/storage`, { key, value })
 *   }
 *
 *   // ... other methods
 * }
 */

import { StorageService } from './storage-interface'
import { SessionStorageAdapter } from './session-storage-adapter'

/**
 * Default storage service instance
 *
 * This is the main storage service used throughout the application.
 * Import this instance to access storage operations.
 *
 * @example
 * import { storage } from '@/lib/storage'
 *
 * // Save data
 * storage.set('myKey', { foo: 'bar' })
 *
 * // Load data with default
 * const data = storage.get('myKey', { foo: 'default' })
 *
 * // Load data without default
 * const optional = storage.getOptional('myKey')
 */
export const storage = new StorageService(new SessionStorageAdapter())

// Re-export types and utilities for convenience
export { StorageService, type IStorageAdapter } from './storage-interface'
export { SessionStorageAdapter } from './session-storage-adapter'
export { StorageKeys } from './storage-keys'
