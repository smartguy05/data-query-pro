# Notes / Gotchas / Lessons Learned

## Architecture
- Database adapter pattern: `lib/database/factory.ts` uses registry pattern - call `DatabaseAdapterFactory.create(type)` to get adapter
- All API routes that call OpenAI check rate limits first, accept user keys via `x-user-openai-key` header
- Server connections (from config/databases.json) have passwords stripped before sending to client; server-side operations use `getServerConnectionCredentials()` to get full credentials
- Error messages from databases are sanitized via `utils/error-sanitizer.ts` to prevent credential leaks

## Common Issues
- Vector stores can expire/be deleted on OpenAI side - handle 404 errors gracefully, auto-reupload schema
- `isInitialized` must be checked before rendering components that depend on context data
- Always update both connections array AND currentConnection when modifying the active connection
- Schema must be uploaded to OpenAI before queries can be generated (creates file + vector store)
- Tables/columns marked `hidden: true` are filtered out before uploading to OpenAI

## State Management
- Context provider: `DatabaseConnectionOptions` in `lib/database-connection-options.tsx`
- StorageProvider abstraction: `lib/storage/storage-provider.ts` interface
  - `LocalStorageProvider`: localStorage (when auth disabled, default)
  - `ApiStorageProvider`: calls /api/data/* routes (when auth enabled)
- Determined at startup via `/api/config/auth-status` endpoint
- localStorage is the persistence layer for single-user mode
- sessionStorage is used for OpenAI API keys (not persisted across sessions)
- Server config merged with local connections on startup

## Authentication Architecture
- Auth is optional: enabled when AUTH_OIDC_ISSUER + AUTH_OIDC_CLIENT_ID + AUTH_OIDC_CLIENT_SECRET are all set
- Auth.js v5 with JWT strategy (no database sessions)
- Admin detection via Authentik groups claim: user in AUTH_ADMIN_GROUP group gets isAdmin=true
- All API routes call `getAuthContext(request)` which returns null when auth disabled (pass-through)
- Connection credentials resolved from app DB (encrypted) when auth enabled, not from client payload
- Server connections still resolved from config/databases.json; assignments tracked in server_connection_assignments table
- Data migration dialog shows on first login when localStorage has data

## Documentation Patterns
- CLAUDE.md is the primary reference for Claude Code - keep project structure tree up to date
- docs/ folder has detailed documentation organized by topic
- When adding new files/features, update both CLAUDE.md structure tree and relevant docs/ files
- .memories/ files track cross-session state - always update after completing tasks
