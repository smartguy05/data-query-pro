# State Management

DataQuery Pro uses React Context backed by a pluggable `StorageProvider` for all application state. This document covers the state architecture and data flow.

## Overview

The application uses a single context provider (`DatabaseConnectionOptions`) that manages:
- Database connections (including server-managed connections)
- Current active connection
- Schema data per connection
- Saved reports
- Connection status

### Storage Modes

| Mode | Provider | Backing Store | When Active |
|------|----------|---------------|-------------|
| Default | `LocalStorageProvider` | Browser localStorage | Auth disabled (no OIDC env vars) |
| Auth | `ApiStorageProvider` | PostgreSQL via `/api/data/*` | Auth enabled (OIDC configured) |

The provider is selected at startup based on the `/api/config/auth-status` response.

## DatabaseContext Provider

**Location:** `lib/database-connection-options.tsx`

### State Variables

```typescript
const [connections, setConnections] = useState<DatabaseConnection[]>([]);
const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");
const [connectionSchemas, setConnectionSchemas] = useState<Schema[]>([]);
const [currentConnection, setCurrentConnection] = useState<DatabaseConnection>();
const [currentSchema, setCurrentSchema] = useState<Schema>();
const [isInitialized, setIsInitialized] = useState(false);
```

### Context Methods

| Method | Purpose |
|--------|---------|
| `getConnection(id?)` | Get connection by ID or current connection |
| `addConnection(conn)` | Add new connection |
| `updateConnection(conn)` | Update existing connection |
| `deleteConnection(id)` | Remove connection |
| `importConnections(conns)` | Bulk import connections |
| `setCurrentConnection(conn)` | Set active connection |
| `refreshConnections()` | Re-fetch all connections and schemas from storage |
| `getSchema(id?)` | Get schema for connection |
| `setSchema(schema)` | Save/update schema |
| `saveReport(report)` | Save a new report |
| `updateReport(report)` | Update existing report |
| `deleteReport(id)` | Delete a report |

### Usage Pattern

```typescript
import { useDatabaseOptions } from '@/lib/database-connection-options';

function MyComponent() {
  const {
    connections,
    currentConnection,
    currentSchema,
    setCurrentConnection,
    addConnection,
    updateConnection,
  } = useDatabaseOptions();

  // Use context values and methods
}
```

## localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `databaseConnections` | `DatabaseConnection[]` | All saved connections |
| `currentDbConnection` | `DatabaseConnection` | Currently active connection |
| `connectionSchemas` | `Schema[]` | All schemas by connection |
| `schema_{connectionId}` | `Schema` | Individual schema cache (legacy) |
| `suggestions_{connectionId}` | `Suggestion[]` | Cached AI suggestions |
| `saved_reports` | `SavedReport[]` | All saved reports |
| `dismissed_notifications` | `string[]` | Dismissed notification IDs |

## Data Flow Diagrams

### Initialization Flow
```
App loads
    │
    ▼
DatabaseConnectionOptions mounts
    │
    ▼
useEffect triggers loadInitialState()
    │
    ├─► localStorage.getItem("databaseConnections")
    │       → setConnections()
    │
    ├─► localStorage.getItem("connectionSchemas")
    │       → setConnectionSchemas()
    │
    └─► localStorage.getItem("currentDbConnection")
            → setCurrentConnection()
            → Find matching schema
            → setCurrentSchema()
    │
    ▼
setIsInitialized(true)
```

### Connection Creation Flow
```
User submits connection form
    │
    ▼
Create DatabaseConnection object
    │
    ▼
context.addConnection(connection)
    │
    ├─► setConnections([...connections, connection])
    │
    └─► localStorage.setItem("databaseConnections", JSON.stringify([...]))
    │
    ▼
context.setCurrentConnection(connection)
    │
    ├─► localStorage.setItem("currentDbConnection", JSON.stringify(...))
    │
    └─► Update all other connections status to "disconnected"
```

### Schema Update Flow
```
Schema introspection completes
    │
    ▼
context.setSchema(schema)
    │
    ├─► Check if schema exists for connectionId
    │       ├─► EXISTS: Update in connectionSchemas array
    │       └─► NEW: Add to connectionSchemas array
    │
    ├─► setConnectionSchemas(updatedSchemas)
    │
    └─► If schema.connectionId === currentConnection.id
            → setCurrentSchema(schema)
    │
    ▼
useEffect triggers on connectionSchemas change
    │
    └─► localStorage.setItem("connectionSchemas", JSON.stringify([...]))
```

## Connection Synchronization

When `currentConnection` changes, the context automatically:

1. Saves to localStorage
2. Updates connection status in the connections array
3. Marks current as "connected", all others as "disconnected"
4. Finds and sets the matching schema as `currentSchema`

```typescript
useEffect(() => {
  if (currentConnection) {
    localStorage.setItem("currentDbConnection", JSON.stringify(currentConnection));

    // Update statuses
    let updatedConnections = connections.map((conn) =>
      conn.id === currentConnection.id
        ? { ...conn, status: "connected" }
        : { ...conn, status: "disconnected" }
    );

    setConnections(updatedConnections);
    localStorage.setItem("databaseConnections", JSON.stringify(updatedConnections));

    // Sync schema
    const schema = getSchema(currentConnection.id);
    setCurrentSchema(schema);
  }
}, [currentConnection]);
```

## Important Patterns

### Always Update Both Connection and CurrentConnection

When modifying the active connection (e.g., adding vectorStoreId):

```typescript
// CORRECT: Update both
updateConnection(updatedConnection);
// updateConnection already updates currentConnection if IDs match

// INCORRECT: Only updating one
setCurrentConnection(updatedConnection); // connections array not updated
```

### Checking Initialization

Always check `isInitialized` before rendering content that depends on loaded data:

```typescript
const { isInitialized, connections } = useDatabaseOptions();

if (!isInitialized) {
  return <LoadingSpinner />;
}

// Safe to use connections now
```

### Schema-Connection Relationship

Each schema is linked to a connection via `connectionId`:

```typescript
interface Schema {
  connectionId: string;  // Links to DatabaseConnection.id
  tables: DatabaseTable[];
}
```

## Reports Storage

Reports are managed through the context and StorageProvider:

```typescript
const { reports, saveReport, updateReport, deleteReport } = useDatabaseOptions();

// Reports are filtered by active connection in the SavedReports component
const connectionReports = reports.filter(r => r.connectionId === connectionId);

// Copy report to another connection
const copy = { ...report, id: newId, connectionId: targetConnectionId };
await saveReport(copy);
```

Reports are tied to a specific connection via `connectionId`. When a connection is deleted, its reports are automatically cascade-deleted (via FK constraint in migration 003).

## Suggestions Caching

AI suggestions are cached per connection through the StorageProvider:

```typescript
// Default mode: localStorage key pattern
const key = `suggestions_${connectionId}`;

// Auth mode: stored in suggestions_cache table via /api/data/suggestions/[connectionId]
```

## Content Loading Gate

The `ContentLoadingGate` component (in `app/layout.tsx`) prevents page content from rendering until the context is initialized, avoiding a flash of empty/default state:

```typescript
// ContentLoadingGate shows a spinner until isInitialized is true
// Excluded paths: /landing, /auth/login
```

## Server Connection Visibility

In auth mode, server connections have special visibility rules:
- **Admins** see all server connections (regardless of schema status)
- **Non-admin users** only see server connections that have a schema uploaded
- Schemas are shared for server connections — admin-uploaded schemas are visible to all assigned users

## SSR Considerations

The context handles SSR by:

1. Using `useState` with empty defaults
2. Loading from StorageProvider in `useEffect` (client-side only)
3. Setting `isInitialized` flag after load
4. `ContentLoadingGate` prevents premature rendering

Components should check `isInitialized` or use conditional rendering to avoid hydration mismatches.

## Related Documentation
- [Architecture Overview](./overview.md) - System architecture
- [Models Overview](../models/overview.md) - TypeScript interfaces
- [Getting Started](../guides/getting-started.md) - Setup guide
