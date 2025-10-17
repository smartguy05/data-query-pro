# Storage Migration Guide

## Overview

This application now uses a centralized storage abstraction layer that makes it easy to migrate from sessionStorage to a database backend in the future.

## Current Implementation

**Storage Backend**: sessionStorage (browser-only, cleared when tab closes)

**Key Improvements over localStorage:**
- ✅ More secure - data cleared when browser tab closes
- ✅ Session-scoped - reduces credential exposure risk
- ✅ Centralized - all storage operations go through one interface
- ✅ Type-safe - TypeScript support with generics
- ✅ SSR-compatible - gracefully handles server-side rendering

## Architecture

### Storage Interface (`storage-interface.ts`)
Defines the contract that all storage adapters must implement:
- `getItem(key: string): string | null`
- `setItem(key: string, value: string): void`
- `removeItem(key: string): void`
- `clear(): void`

### Storage Service (`storage-interface.ts`)
Provides type-safe, JSON-based operations:
- `get<T>(key, defaultValue)` - Get with default value
- `getOptional<T>(key)` - Get without default (returns null if not found)
- `set<T>(key, value)` - Set with automatic JSON serialization
- `remove(key)` - Remove a key
- `clear()` - Clear all data

### Storage Keys (`storage-keys.ts`)
Centralized key management to prevent typos and track all stored data:
```typescript
export const StorageKeys = {
  DATABASE_CONNECTIONS: 'databaseConnections',
  CURRENT_DB_CONNECTION: 'currentDbConnection',
  CONNECTION_SCHEMAS: 'connectionSchemas',
  SAVED_REPORTS: 'saved_reports',
  DISMISSED_NOTIFICATIONS: 'dismissed_notifications',

  // Dynamic keys
  suggestions: (connectionId: string) => `suggestions_${connectionId}`,
  schema: (connectionId: string) => `schema_${connectionId}`,
}
```

### Current Adapters

#### SessionStorageAdapter (`session-storage-adapter.ts`)
- Production adapter using browser sessionStorage
- SSR-compatible (gracefully returns null during server rendering)
- Data cleared when tab closes

#### MemoryStorageAdapter (`memory-storage-adapter.ts`)
- Fallback for testing and SSR
- In-memory only (not persistent)

## Usage

Import and use the centralized storage service:

```typescript
import { storage, StorageKeys } from '@/lib/storage'

// Save data
const connections = [...];
storage.set(StorageKeys.DATABASE_CONNECTIONS, connections)

// Load data with default
const connections = storage.get<DatabaseConnection[]>(StorageKeys.DATABASE_CONNECTIONS, [])

// Load data without default (returns null if not found)
const connection = storage.getOptional<DatabaseConnection>(StorageKeys.CURRENT_DB_CONNECTION)

// Dynamic keys
const suggestions = storage.get<Suggestion[]>(StorageKeys.suggestions(connectionId), [])
```

## What Data Is Stored?

All application state is stored in sessionStorage:

| Key | Type | Description |
|-----|------|-------------|
| `databaseConnections` | `DatabaseConnection[]` | All saved database connections |
| `currentDbConnection` | `DatabaseConnection` | Currently active connection |
| `connectionSchemas` | `Schema[]` | Schemas for all connections |
| `saved_reports` | `SavedReport[]` | All saved query reports |
| `dismissed_notifications` | `string[]` | IDs of dismissed notifications |
| `suggestions_{connectionId}` | `MetricSuggestion[]` | AI suggestions per connection |
| `schema_{connectionId}` | `Schema` | Individual schema per connection |

## Migrating to Database Storage

### Step 1: Create API Routes

Create API routes to handle database operations:

```typescript
// app/api/storage/[key]/route.ts
export async function GET(request: Request, { params }: { params: { key: string } }) {
  const key = params.key
  const value = await db.storage.findUnique({ where: { key } })
  return NextResponse.json({ value: value?.data })
}

export async function POST(request: Request) {
  const { key, value } = await request.json()
  await db.storage.upsert({
    where: { key },
    create: { key, data: value },
    update: { data: value }
  })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request, { params }: { params: { key: string } }) {
  await db.storage.delete({ where: { key: params.key } })
  return NextResponse.json({ success: true })
}
```

### Step 2: Create Database Adapter

Create a new adapter that implements `IStorageAdapter`:

```typescript
// lib/storage/database-storage-adapter.ts
import { IStorageAdapter } from './storage-interface'

export class DatabaseStorageAdapter implements IStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    const response = await fetch(`/api/storage/${key}`)
    if (!response.ok) return null
    const data = await response.json()
    return data.value
  }

  async setItem(key: string, value: string): Promise<void> {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    })
  }

  async removeItem(key: string): Promise<void> {
    await fetch(`/api/storage/${key}`, { method: 'DELETE' })
  }

  async clear(): Promise<void> {
    await fetch('/api/storage', { method: 'DELETE' })
  }

  get length(): number {
    throw new Error('length not supported for async storage')
  }

  key(index: number): string | null {
    throw new Error('key() not supported for async storage')
  }
}
```

### Step 3: Update Storage Service for Async

The current `StorageService` is synchronous. For database storage, you'll need an async version:

```typescript
// lib/storage/async-storage-service.ts
export class AsyncStorageService {
  constructor(private adapter: IStorageAdapter) {}

  async get<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const item = await this.adapter.getItem(key)
      if (item === null) return defaultValue
      return JSON.parse(item) as T
    } catch (error) {
      console.error(`Error reading from storage (key: ${key}):`, error)
      return defaultValue
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      await this.adapter.setItem(key, serialized)
    } catch (error) {
      console.error(`Error writing to storage (key: ${key}):`, error)
      throw error
    }
  }

  // ... other async methods
}
```

### Step 4: Update lib/storage/index.ts

Replace the sessionStorage adapter with the database adapter:

```typescript
// lib/storage/index.ts
import { AsyncStorageService } from './async-storage-service'
import { DatabaseStorageAdapter } from './database-storage-adapter'

export const storage = new AsyncStorageService(new DatabaseStorageAdapter())
```

### Step 5: Update Components

Since the storage service is now async, update all components:

```typescript
// Before (synchronous)
const connections = storage.get<DatabaseConnection[]>(StorageKeys.DATABASE_CONNECTIONS, [])

// After (asynchronous)
const [connections, setConnections] = useState<DatabaseConnection[]>([])

useEffect(() => {
  storage.get<DatabaseConnection[]>(StorageKeys.DATABASE_CONNECTIONS, [])
    .then(setConnections)
}, [])
```

### Step 6: Database Schema

Create a simple key-value storage table:

```sql
CREATE TABLE storage (
  key VARCHAR(255) PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_storage_key ON storage(key);
```

Or using Prisma:

```prisma
model Storage {
  key       String   @id
  data      String   @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Hybrid Approach

For best performance, you can use a hybrid approach:

1. **Session Storage** - For non-sensitive, frequently accessed data
2. **Database Storage** - For sensitive data (connections, credentials) and data that needs to persist across sessions

```typescript
// lib/storage/hybrid-storage-adapter.ts
export class HybridStorageAdapter implements IStorageAdapter {
  constructor(
    private sessionAdapter: SessionStorageAdapter,
    private dbAdapter: DatabaseStorageAdapter,
    private dbKeys: Set<string> // Keys that should go to database
  ) {}

  async getItem(key: string): Promise<string | null> {
    if (this.dbKeys.has(key)) {
      return await this.dbAdapter.getItem(key)
    }
    return this.sessionAdapter.getItem(key)
  }

  // ... implement other methods similarly
}

// Configure which keys go to database
const dbKeys = new Set([
  StorageKeys.DATABASE_CONNECTIONS,
  StorageKeys.CURRENT_DB_CONNECTION,
  StorageKeys.SAVED_REPORTS,
])

export const storage = new AsyncStorageService(
  new HybridStorageAdapter(
    new SessionStorageAdapter(),
    new DatabaseStorageAdapter(),
    dbKeys
  )
)
```

## Benefits of This Architecture

1. **Easy Migration** - Swap adapters without changing application code
2. **Testable** - Use MemoryStorageAdapter for unit tests
3. **Flexible** - Mix multiple storage backends (hybrid approach)
4. **Type-Safe** - Full TypeScript support with generics
5. **Centralized** - Single source of truth for all storage operations
6. **Maintainable** - All storage keys defined in one place

## Security Considerations

### Current (sessionStorage):
- ✅ Data cleared when tab closes
- ✅ Not shared across tabs
- ⚠️ Still accessible via browser dev tools
- ⚠️ No server-side persistence

### Future (Database):
- ✅ Server-side encryption possible
- ✅ User authentication/authorization
- ✅ Audit logs for data access
- ✅ Backup and recovery
- ⚠️ Requires secure API endpoints
- ⚠️ Network overhead for each operation

## Testing

### Unit Tests with Memory Adapter

```typescript
import { StorageService } from '@/lib/storage/storage-interface'
import { MemoryStorageAdapter } from '@/lib/storage/memory-storage-adapter'

describe('MyComponent', () => {
  let storage: StorageService

  beforeEach(() => {
    storage = new StorageService(new MemoryStorageAdapter())
  })

  it('should save and load data', () => {
    storage.set('test-key', { foo: 'bar' })
    const data = storage.get('test-key', null)
    expect(data).toEqual({ foo: 'bar' })
  })
})
```

## Rollback Plan

If you need to revert to localStorage:

1. Create a `LocalStorageAdapter` (same as SessionStorageAdapter but using `localStorage`)
2. Update `lib/storage/index.ts` to use `LocalStorageAdapter`
3. Rebuild and deploy

The rest of the application code remains unchanged.
