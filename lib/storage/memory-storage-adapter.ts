/**
 * Memory Storage Adapter
 *
 * This adapter implements the IStorageAdapter interface using in-memory storage.
 * It's used as a fallback for server-side rendering where sessionStorage is not available.
 *
 * Note: Data stored in memory is lost when the server restarts or the page is reloaded.
 * This is intended only for SSR compatibility, not for actual data persistence on the server.
 */

import { IStorageAdapter } from './storage-interface'

export class MemoryStorageAdapter implements IStorageAdapter {
  private storage: Map<string, string> = new Map()

  getItem(key: string): string | null {
    return this.storage.get(key) || null
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value)
  }

  removeItem(key: string): void {
    this.storage.delete(key)
  }

  clear(): void {
    this.storage.clear()
  }

  get length(): number {
    return this.storage.size
  }

  key(index: number): string | null {
    const keys = Array.from(this.storage.keys())
    return keys[index] || null
  }
}
