/**
 * Session Storage Adapter
 *
 * This adapter implements the IStorageAdapter interface using sessionStorage.
 * sessionStorage is more secure than localStorage because:
 * - Data is cleared when the page session ends (tab is closed)
 * - Data is not shared across different tabs/windows
 * - Reduces risk of long-term credential exposure
 *
 * Note: This adapter can only be used in browser environments (client-side).
 * During SSR, it will silently fail (return null for getItem, no-op for setItem).
 */

import { IStorageAdapter } from './storage-interface'

export class SessionStorageAdapter implements IStorageAdapter {
  private storage: Storage | null = null

  constructor() {
    // Only initialize sessionStorage if we're in a browser environment
    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      this.storage = sessionStorage
    }
  }

  getItem(key: string): string | null {
    if (!this.storage) return null
    return this.storage.getItem(key)
  }

  setItem(key: string, value: string): void {
    if (!this.storage) return
    this.storage.setItem(key, value)
  }

  removeItem(key: string): void {
    if (!this.storage) return
    this.storage.removeItem(key)
  }

  clear(): void {
    if (!this.storage) return
    this.storage.clear()
  }

  get length(): number {
    if (!this.storage) return 0
    return this.storage.length
  }

  key(index: number): string | null {
    if (!this.storage) return null
    return this.storage.key(index)
  }
}
