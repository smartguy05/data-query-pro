# State Management

DataQuery Pro uses React Context with localStorage persistence for all application state. This document covers the state architecture and data flow.

## Overview

The application uses a single context provider (`DatabaseConnectionOptions`) that manages:
- Database connections
- Current active connection
- Schema data per connection
- Connection status

All data persists to localStorage for client-side storage.

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
| `getSchema(id?)` | Get schema for connection |
| `setSchema(schema)` | Save/update schema |

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

Reports are stored separately in localStorage, not in the context:

```typescript
// Reading reports
const reports = JSON.parse(localStorage.getItem('saved_reports') || '[]');

// Filtering by connection
const connectionReports = reports.filter(r => r.connectionId === connectionId);

// Saving reports
localStorage.setItem('saved_reports', JSON.stringify(updatedReports));
```

## Suggestions Caching

AI suggestions are cached per connection:

```typescript
// Key pattern
const key = `suggestions_${connectionId}`;

// Save suggestions
localStorage.setItem(key, JSON.stringify(suggestions));

// Load suggestions
const cached = JSON.parse(localStorage.getItem(key) || '[]');
```

## SSR Considerations

Because the app relies on localStorage, it won't work in SSR contexts. The context handles this by:

1. Using `useState` with empty defaults
2. Loading from localStorage in `useEffect` (client-side only)
3. Setting `isInitialized` flag after load

Components should check `isInitialized` or use conditional rendering to avoid hydration mismatches.

## Related Documentation
- [Architecture Overview](./overview.md) - System architecture
- [Models Overview](../models/overview.md) - TypeScript interfaces
- [Getting Started](../guides/getting-started.md) - Setup guide
