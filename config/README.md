# Server Database Configuration

This directory contains server-side database connection configurations that are shared across all users of the application.

## Setup

1. Copy `databases.json.example` to `databases.json`
2. Update the connection details with your actual database credentials
3. Deploy the `databases.json` file with your application

## File Format

The `databases.json` file should contain a JSON object with a `connections` array:

```json
{
  "connections": [
    {
      "id": "unique-connection-id",
      "name": "Display Name",
      "type": "postgresql",
      "host": "db.example.com",
      "port": "5432",
      "database": "database_name",
      "username": "username",
      "password": "password",
      "description": "Optional description",
      "status": "disconnected",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Field Descriptions

- **id**: Unique identifier for the connection (required, string)
- **name**: Display name shown in the UI (required, string)
- **type**: Database type - `postgresql`, `mysql`, `sqlserver`, or `sqlite` (required, string)
- **host**: Database server hostname (required for non-SQLite)
- **port**: Database server port (required for non-SQLite)
- **database**: Database name (required)
- **username**: Database username (required)
- **password**: Database password (required)
- **filepath**: File path for SQLite databases (optional, only for SQLite)
- **description**: Human-readable description (optional, string)
- **status**: Initial status, should be "disconnected" (required)
- **createdAt**: ISO 8601 timestamp (required, string)
- **schemaFileId**: OpenAI file ID if schema already uploaded (optional, string)
- **vectorStoreId**: OpenAI vector store ID if already created (optional, string)

## Supported Database Types

Currently supported values for the `type` field:

- `postgresql` - PostgreSQL (fully supported)
- `mysql` - MySQL (adapter available)
- `sqlserver` - Microsoft SQL Server (adapter available)
- `sqlite` - SQLite (adapter available)

**Note**: Currently, the application has full implementation for PostgreSQL. Other database types have adapters but may require additional testing.

## Security Considerations

⚠️ **Important Security Notes**:

1. **Credentials Storage**: The `databases.json` file contains plain-text credentials. Ensure this file:
   - Is NOT committed to version control (add to `.gitignore`)
   - Has appropriate file permissions (readable only by the application)
   - Is stored securely in production environments

2. **Read-Only Access**: For production databases, use read-only database credentials to prevent accidental data modification

3. **Environment Variables**: For production deployments, consider using environment variables instead of the JSON file, or encrypting sensitive values

4. **Network Security**: Ensure database servers are only accessible from trusted networks/IPs

## How It Works

1. When the application starts, it loads connections from `config/databases.json`
2. These server connections are merged with user's local connections from localStorage
3. Server connections are displayed with a "Server Config" badge in the UI
4. Server connections cannot be edited or deleted through the UI
5. Users can still:
   - Select and use server connections
   - Upload schema files for server connections
   - Create queries using server connections
   - Save reports linked to server connections

## File Location

The application looks for the config file at:
```
<project-root>/config/databases.json
```

If the file doesn't exist, the application will continue working normally with only local connections available.

## Shared Reports (`reports.json`)

In addition to shared connections, you can ship pre-built **saved reports** to everyone using the app via an optional `config/reports.json` file. This mirrors how `databases.json` works.

### Setup

1. On the **Reports** page, click **Export Reports**, choose the databases/reports you want, and download the file.
2. Copy the downloaded file to `config/reports.json` (or copy `reports.json.example` and edit it).
3. Deploy `config/reports.json` with your application.

### File Format

```json
{
  "version": "1.0",
  "reports": [
    {
      "id": "shared-report-monthly-revenue",
      "connectionId": "shared-analytics-db",
      "name": "Monthly Revenue Summary",
      "naturalLanguageQuery": "Show total revenue by month for this year",
      "sql": "SELECT ...",
      "explanation": "...",
      "warnings": [],
      "confidence": 0.95,
      "parameters": [],
      "createdAt": "2024-01-01T00:00:00Z",
      "lastModified": "2024-01-01T00:00:00Z"
    }
  ]
}
```

A bare top-level array (`[ { ... } ]`) is also accepted.

### How It Works

1. On load, the app reads `config/reports.json` and merges these reports with the user's local reports.
2. Config reports are **always present** (re-loaded on every page load) and **read-only** — they are marked with a "Server Config" badge and cannot be edited, deleted, or favorited in the UI.
3. They are **never written to the user's localStorage**, so they always reflect the current config file.
4. Users can **Clone** or **Copy to Connection** a server report to create their own editable local copy.

### Important: `connectionId` Must Match

Each report's `connectionId` must match the `id` of a connection in `config/databases.json` (or one of the user's local connection ids) for the report to resolve and run. When you export reports tied to server connections, the ids already line up.

### Notes

- This is a **non-auth-mode** feature, the same as `databases.json`. When authentication is enabled, `config/reports.json` is not used (reports are managed in the database instead).
- If `config/reports.json` doesn't exist, the app works normally with only local reports.
- The legacy `savedReports` field inside `databases.json` is still supported, but it only **seeds** reports into localStorage once (when the user has none). Prefer `reports.json` for always-present shared reports.

## Example Use Cases

1. **Team Sharing**: Deploy shared database connections for all team members
2. **Multi-Environment**: Provide connections to dev, staging, and production databases
3. **Read-Only Analytics**: Give users safe, read-only access to production data
4. **Onboarding**: New users automatically have access to team databases
5. **Standard Reports**: Ship a curated set of saved reports via `reports.json` so everyone starts with the same dashboards

## Troubleshooting

### Connections Not Appearing

1. Verify `databases.json` exists in the `config/` directory
2. Check the JSON syntax is valid (use a JSON validator)
3. Check browser console for error messages
4. Ensure the file is readable by the Node.js process

### Connections Show as "Server Config" but Can't Edit

This is expected behavior. Server connections are read-only in the UI to prevent accidental modifications. To edit:

1. Update the `config/databases.json` file directly
2. Restart the application to reload the configuration

### Schema Upload Required

Even for server connections, users need to upload the database schema to OpenAI before they can generate queries. This is a one-time operation per connection.

Alternatively, you can pre-upload schemas and include the `schemaFileId` and `vectorStoreId` in the config file.
