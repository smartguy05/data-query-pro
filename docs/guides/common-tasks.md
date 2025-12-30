# Common Tasks

Frequent development workflows and how to accomplish them.

## Adding a New Page

1. **Create page file:**
```tsx
// app/new-page/page.tsx
"use client"

import { useDatabaseOptions } from "@/lib/database-connection-options"
import Navigation from "@/components/navigation"

export default function NewPage() {
  const { currentConnection } = useDatabaseOptions()

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-6">
        <h1 className="text-2xl font-bold">New Page</h1>
        {/* Page content */}
      </main>
    </div>
  )
}
```

2. **Add to navigation:**
```tsx
// components/navigation.tsx
const navItems = [
  // ... existing items
  { href: "/new-page", label: "New Page" },
]
```

## Adding a New API Endpoint

1. **Create route file:**
```tsx
// app/api/new-endpoint/route.ts
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    if (!body.requiredField) {
      return NextResponse.json(
        { error: "requiredField is required" },
        { status: 400 }
      )
    }

    // Process request
    const result = await processData(body)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Endpoint error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

2. **Call from client:**
```typescript
const response = await fetch('/api/new-endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ requiredField: value })
})
const data = await response.json()
```

## Adding a New Component

1. **Create component file:**
```tsx
// components/my-component.tsx
"use client"

interface MyComponentProps {
  title: string
  onAction: () => void
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  return (
    <div className="p-4 border rounded-lg">
      <h2 className="font-semibold">{title}</h2>
      <button onClick={onAction}>Action</button>
    </div>
  )
}
```

2. **Use in page:**
```tsx
import { MyComponent } from "@/components/my-component"

// In your page
<MyComponent title="Hello" onAction={() => console.log('clicked')} />
```

## Adding a shadcn/ui Component

```bash
# Add a new component
npx shadcn@latest add [component-name]

# Examples
npx shadcn@latest add alert
npx shadcn@latest add sheet
npx shadcn@latest add calendar
```

Then import and use:
```tsx
import { Alert, AlertDescription } from "@/components/ui/alert"

<Alert>
  <AlertDescription>This is an alert</AlertDescription>
</Alert>
```

## Adding a New Data Model

1. **Create interface:**
```typescript
// models/my-model.interface.ts
export interface MyModel {
  id: string
  name: string
  createdAt: string
  // ... fields
}
```

2. **Use in components:**
```typescript
import { MyModel } from "@/models/my-model.interface"

const items: MyModel[] = []
```

## Modifying the Context

1. **Add state:**
```tsx
// lib/database-connection-options.tsx
const [newState, setNewState] = useState<NewType>(defaultValue)
```

2. **Add method:**
```tsx
const newMethod = (param: ParamType): ReturnType => {
  // Implementation
}
```

3. **Expose in provider:**
```tsx
<DatabaseContext.Provider value={{
  // ... existing
  newState,
  setNewState,
  newMethod,
}}>
```

4. **Update context type:**
```typescript
// models/database-context-type.interface.ts
interface DatabaseContextType {
  // ... existing
  newState: NewType
  setNewState: (value: NewType) => void
  newMethod: (param: ParamType) => ReturnType
}
```

## Adding localStorage Persistence

```typescript
// Save to localStorage
const saveToStorage = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data))
}

// Load from localStorage
const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch {
    return defaultValue
  }
}

// Use in component
useEffect(() => {
  const data = loadFromStorage('my_key', [])
  setMyState(data)
}, [])

useEffect(() => {
  saveToStorage('my_key', myState)
}, [myState])
```

## Adding Toast Notifications

```typescript
import { useToast } from "@/hooks/use-toast"

function MyComponent() {
  const { toast } = useToast()

  const handleSuccess = () => {
    toast({
      title: "Success",
      description: "Operation completed successfully"
    })
  }

  const handleError = (error: Error) => {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive"
    })
  }
}
```

## Adding Loading States

```tsx
const [isLoading, setIsLoading] = useState(false)

const handleAction = async () => {
  setIsLoading(true)
  try {
    await doAsyncWork()
  } finally {
    setIsLoading(false)
  }
}

return (
  <Button onClick={handleAction} disabled={isLoading}>
    {isLoading ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </>
    ) : (
      'Click Me'
    )}
  </Button>
)
```

## Testing Database Connections

Currently simulated. To add real testing:

```typescript
// app/api/connection/test/route.ts
export async function POST(request: NextRequest) {
  const { connection } = await request.json()

  try {
    const sql = postgres({
      host: connection.host,
      port: Number.parseInt(connection.port),
      database: connection.database,
      username: connection.username,
      password: connection.password,
      connect_timeout: 5,
    })

    await sql`SELECT 1`
    await sql.end()

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    )
  }
}
```

## Debugging Tips

### Enable Console Logging
API routes have console.log statements that output to terminal:
```typescript
console.log("[v0] Executing SQL query:", sql)
```

### Check localStorage
In browser DevTools:
```javascript
// View all keys
Object.keys(localStorage)

// View specific data
JSON.parse(localStorage.getItem('databaseConnections'))
```

### Check Context State
Add temporary logging:
```tsx
const context = useDatabaseOptions()
console.log('Context state:', context)
```

## Formatting and Linting

```bash
# Run linter
npm run lint

# Auto-fix lint issues
npm run lint -- --fix
```

---

## Related Documentation
- [Getting Started](./getting-started.md) - Setup guide
- [Architecture Overview](../architecture/overview.md) - System design
- [Components Overview](../components/overview.md) - Component patterns
