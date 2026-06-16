# Infrastructure & Cross-Cutting Components

Providers, navigation, theming, authentication, sharing, and reusable modals that
support the feature components but are not tied to a single feature.

See also: [Feature Components](./features.md) · [Page Components](./pages.md) · [Components Overview](./overview.md)

## Providers

### AuthProvider
**File:** `components/auth-provider.tsx`

Conditionally wraps the app in next-auth's `SessionProvider`.

- Fetches `/api/config/auth-status` on mount.
- When auth is disabled (or while the status is unknown), renders children **without**
  a `SessionProvider` so the app works in localStorage-only mode.
- When auth is enabled, wraps children in `<SessionProvider>`.

### OpenAIApiProvider
**File:** `components/openai-api-provider.tsx`

Context provider for OpenAI API key management (BYOK).

- Stores the key in `sessionStorage` (never localStorage or the server).
- Syncs between tabs via storage events.
- Provides `setApiKey`, `clearApiKey`, `getAuthHeaders`.
- Exposes the `useOpenAIApiContext` hook.

### ThemeProvider
**File:** `components/theme-provider.tsx`

Wrapper for `next-themes`.

```tsx
<ThemeProvider attribute="class" defaultTheme="system">
  {children}
</ThemeProvider>
```

## Loading & Error Boundaries

### ContentLoadingGate
**File:** `components/content-loading-gate.tsx`

Blocks page content until the database context has initialized, preventing a flash of
empty UI.

- Renders a centered spinner while `isInitialized` is false.
- **Ungated paths** (`/landing`, `/auth/login`) render immediately without waiting for
  context — keep this list in sync if you add public routes.

### ErrorBoundary
**File:** `components/error-boundary.tsx`

React class component that catches JavaScript errors in child components.

- Fallback UI with error message and a reset button.
- Optional custom fallback component.
- `withErrorBoundary` HOC for wrapping components.

```tsx
<ErrorBoundary>
  <ComponentThatMightError />
</ErrorBoundary>

// Or with HOC
const SafeComponent = withErrorBoundary(MyComponent);
```

## Navigation & Theme

### Navigation
**File:** `components/navigation.tsx`

Top navigation bar.

- Route links with active state (blue highlight).
- Theme toggle and API key status indicator (when rate limiting enabled).
- User menu when auth is enabled.
- Mobile responsive with collapsible menu.
- Skips rendering on the `/landing` page.

### ThemeToggle
**File:** `components/theme-toggle.tsx`

Toggle button for dark/light mode.

## API Key (BYOK) Components

### ApiKeyDialog
**File:** `components/api-key-dialog.tsx`

Dialog for users to enter their OpenAI API key to bypass rate limits.

- Key validation (must start with `sk-`).
- Reset-time information display and rate-limit-bypass explanation.

### ApiKeyIndicator
**File:** `components/api-key-indicator.tsx`

Navigation indicator showing OpenAI API key status.

- Green checkmark if a key is configured; yellow alert if using the rate-limited demo.
- Popover menu for key management.
- Only renders when rate limiting is enabled.

## Auth-Mode Components

These render meaningful UI only when auth mode is enabled.

### ShareDialog
**File:** `components/share-dialog.tsx`

Share a connection or report with other users and manage existing shares.

**Props:**
```typescript
interface ShareDialogProps {
  resourceId: string;
  resourceType: "connection" | "report";
  resourceName: string;
}
```

- Searches users via `/api/sharing/users/search`.
- Connections support `view` / `edit` / `admin` permissions; reports support `view` / `edit`.
- Reads/writes via the [sharing endpoints](../api/data-endpoints.md#sharing-endpoints-apisharing).

### DataMigrationDialog
**File:** `components/data-migration-dialog.tsx`

First-login prompt to import existing localStorage data into the authenticated account.

- Only shows when auth is enabled, the user is authenticated, and local data exists.
- Skips if `localStorage.localDataMigrated === "true"`.
- Posts to `/api/data/import-local` and reports counts of imported connections, schemas,
  reports, and suggestions.

## Reusable Modals

### ConfirmationModal
**File:** `components/confirmation-modal.tsx`

Generic confirm/cancel dialog used across the app.

**Props:**
```typescript
interface ConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;   // default "Confirm"
  cancelText?: string;    // default "Cancel"
  onConfirm: () => void;
  variant?: "default" | "destructive";
}
```

> A schema-specific modal, `SchemaUpdateModal`, is documented with the
> [Schema feature components](./features.md#schemaupdatemodal).

---

## Related Documentation
- [Components Overview](./overview.md) - Component categories
- [Feature Components](./features.md) - Business-feature components
- [Page Components](./pages.md) - App router pages
- [Auth & Data Layer](../architecture/auth-and-data-layer.md) - How auth mode works
