# Multi-User Setup Guide

This guide explains how to deploy DataQuery Pro with multi-user support, including Azure AD SSO authentication and PostgreSQL-backed storage.

## Overview

Multi-user mode enables:
- **Azure AD SSO** - Single sign-on with your organization's Azure Active Directory
- **Role-based Access** - Admin and user roles with different permissions
- **Connection Permissions** - Control which users can access which databases
- **Report Sharing** - Share saved reports with team members
- **Centralized Storage** - All data stored in PostgreSQL instead of browser localStorage

## Prerequisites

1. **Azure AD Application** - An app registration in Azure Portal
2. **PostgreSQL Database** - For storing users, connections, and permissions
3. **Node.js 18+** - For running the application

## Step 1: Create Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com) > Azure Active Directory > App registrations
2. Click "New registration"
3. Configure:
   - **Name**: DataQuery Pro
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: Web - `http://localhost:3000/api/auth/callback/azure-ad`
4. After creation, note the:
   - **Application (client) ID**
   - **Directory (tenant) ID**
5. Go to "Certificates & secrets" > "New client secret"
   - Note the **secret value** (you won't see it again)
6. Go to "API permissions" > Add these Microsoft Graph permissions:
   - `User.Read` (delegated)
   - `openid` (delegated)
   - `profile` (delegated)
   - `email` (delegated)

## Step 2: Set Up PostgreSQL Database

### Option A: Using Podman (Recommended for Development)

```powershell
# Windows (PowerShell)
cd scripts
.\setup-podman.ps1
```

```bash
# Linux/Mac
cd scripts
chmod +x setup-podman.sh
./setup-podman.sh
```

The script creates a container with:
- Database: `dataquery_pro`
- Username: `postgres`
- Password: `postgres`
- Port: `5432`

### Option B: Manual Setup

1. Create a PostgreSQL database
2. Run the initialization script:
   ```bash
   psql -U postgres -d dataquery_pro -f scripts/init-db.sql
   ```

### Database Schema

The initialization script creates these tables:

| Table | Purpose |
|-------|---------|
| `users` | Authenticated users from Azure SSO |
| `database_connections` | Admin-managed database connections |
| `connection_permissions` | User-to-connection access mapping |
| `connection_schemas` | Introspected schema data |
| `saved_reports` | User reports with sharing |
| `user_suggestions` | AI suggestions per user |
| `dismissed_notifications` | Per-user notification state |

## Step 3: Configure Environment Variables

Create or update `.env.local`:

```bash
# OpenAI (required)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# Multi-user mode (required for this feature)
MULTI_USER_ENABLED=true
NEXT_PUBLIC_MULTI_USER_ENABLED=true

# PostgreSQL connection
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=dataquery_pro
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=postgres

# Password encryption key (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your_32_byte_hex_key

# Azure AD
AZURE_AD_CLIENT_ID=your_application_client_id
AZURE_AD_CLIENT_SECRET=your_client_secret
AZURE_AD_TENANT_ID=your_tenant_id

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_random_secret  # Generate with: openssl rand -base64 32
```

### Generating Keys

```bash
# Generate ENCRYPTION_KEY
openssl rand -hex 32

# Generate NEXTAUTH_SECRET
openssl rand -base64 32
```

## Step 4: Domain Restriction (Optional)

By default, the application restricts login to users from your Azure AD tenant. To further restrict to specific email domains, edit `lib/auth/auth.config.ts`:

```typescript
// In the signIn callback
const allowedDomain = "yourdomain.com";
if (!email.endsWith(`@${allowedDomain}`)) {
  return false;
}
```

## Step 5: Start the Application

```bash
npm run dev
```

Visit `http://localhost:3000` and you'll be redirected to the Azure AD login page.

## First User Setup

The **first user** to log in is automatically assigned the **admin** role. This user can then:
1. Create database connections via the Admin panel
2. Grant other users access to connections
3. Manage user roles

## Admin Features

Access the admin panel at `/admin` (visible only to admin users).

### User Management (`/admin/users`)
- View all registered users
- Change user roles (admin/user)
- Delete users

### Connection Management (`/admin/connections`)
- Create new database connections
- Edit connection details
- Delete connections

### Permission Matrix (`/admin/permissions`)
- Grant/revoke user access to connections
- View permissions overview
- Admins automatically have access to all connections

## User Features

Regular users can:
- View and query databases they have access to
- Create and save reports
- Share reports with other users
- View shared reports from team members

## Report Sharing

Users can share their reports:
1. Go to Reports page
2. Click the dropdown menu on a report card
3. Select "Share Report" or "Make Private"

Shared reports are visible to all users who have access to the same database connection.

## Security Considerations

1. **Password Encryption**: Database connection passwords are encrypted with AES-256-GCM using the `ENCRYPTION_KEY`
2. **Route Protection**: Middleware protects all routes and API endpoints
3. **Admin Routes**: Only users with `role: "admin"` can access admin routes
4. **Connection Access**: Users can only query databases they have explicit permission to access
5. **JWT Sessions**: Sessions expire after 24 hours

## Troubleshooting

### "Invalid redirect URI" error
- Ensure the redirect URI in Azure AD matches exactly: `http://localhost:3000/api/auth/callback/azure-ad`
- For production, update to your production URL

### "User not in allowed domain" error
- Check the domain restriction in `lib/auth/auth.config.ts`
- Ensure your email matches the allowed domain

### Database connection errors
- Verify PostgreSQL is running: `podman ps` or `docker ps`
- Check connection credentials in `.env.local`
- Ensure the `init-db.sql` script has been run

### "NEXTAUTH_SECRET" missing error
- Add `NEXTAUTH_SECRET` to `.env.local`
- Restart the development server

## Production Deployment

For production:
1. Update `NEXTAUTH_URL` to your production URL
2. Add production redirect URI to Azure AD app
3. Use a managed PostgreSQL service
4. Set secure, random values for `ENCRYPTION_KEY` and `NEXTAUTH_SECRET`
5. Enable HTTPS
