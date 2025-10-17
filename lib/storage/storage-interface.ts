/**
 * Storage Interface
 *
 * This interface defines the contract for all storage adapters.
 * Implementations can use sessionStorage, localStorage, or a remote database.
 *
 * This abstraction makes it easy to switch storage backends in the future.
 */

export interface IStorageAdapter {
  /**
   * Get an item from storage
   * @param key The storage key
   * @returns The stored value as a string, or null if not found
   */
  getItem(key: string): string | null

  /**
   * Set an item in storage
   * @param key The storage key
   * @param value The value to store (as a string)
   */
  setItem(key: string, value: string): void

  /**
   * Remove an item from storage
   * @param key The storage key
   */
  removeItem(key: string): void

  /**
   * Clear all items from storage
   */
  clear(): void

  /**
   * Get the number of items in storage
   */
  get length(): number

  /**
   * Get the key at a specific index
   * @param index The index
   */
  key(index: number): string | null
}

/**
 * Type-safe storage service with JSON serialization
 *
 * This class wraps the storage adapter and provides:
 * - Automatic JSON serialization/deserialization
 * - Type-safe getters and setters
 * - Error handling
 * - Easy migration path to database storage
 */
export class StorageService {
  private adapter: IStorageAdapter

  constructor(adapter: IStorageAdapter) {
    this.adapter = adapter
  }

  /**
   * Get a value from storage and parse it as JSON
   * @param key The storage key
   * @param defaultValue The default value if key doesn't exist
   * @returns The parsed value or default
   */
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = this.adapter.getItem(key)
      if (item === null) {
        return defaultValue
      }
      return JSON.parse(item) as T
    } catch (error) {
      console.error(`Error reading from storage (key: ${key}):`, error)
      return defaultValue
    }
  }

  /**
   * Get a value from storage without a default value
   * @param key The storage key
   * @returns The parsed value or null
   */
  getOptional<T>(key: string): T | null {
    try {
      const item = this.adapter.getItem(key)
      if (item === null) {
        return null
      }
      return JSON.parse(item) as T
    } catch (error) {
      console.error(`Error reading from storage (key: ${key}):`, error)
      return null
    }
  }

  /**
   * Set a value in storage (automatically serialized as JSON)
   * @param key The storage key
   * @param value The value to store
   */
  set<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value)
      this.adapter.setItem(key, serialized)
    } catch (error) {
      console.error(`Error writing to storage (key: ${key}):`, error)
      throw error
    }
  }

  /**
   * Remove a value from storage
   * @param key The storage key
   */
  remove(key: string): void {
    try {
      this.adapter.removeItem(key)
    } catch (error) {
      console.error(`Error removing from storage (key: ${key}):`, error)
    }
  }

  /**
   * Clear all values from storage
   */
  clear(): void {
    try {
      this.adapter.clear()
    } catch (error) {
      console.error('Error clearing storage:', error)
    }
  }

  /**
   * Get the underlying storage adapter
   * Useful for direct access when needed
   */
  getAdapter(): IStorageAdapter {
    return this.adapter
  }
}
