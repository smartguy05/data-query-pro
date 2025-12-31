/**
 * PostgreSQL Storage Adapter
 *
 * Implements the storage service interfaces using PostgreSQL.
 * Used when MULTI_USER_ENABLED=true.
 */

import { getPool } from '@/lib/db/connection';
import { encrypt, decrypt } from '@/lib/db/encryption';
import type {
  IStorageService,
  IConnectionStorageService,
  ISchemaStorageService,
  IReportStorageService,
  ISuggestionStorageService,
  IUserStorageService,
  IPermissionStorageService,
  INotificationStorageService,
  User,
  MetricSuggestion,
  DatabaseConnection,
  Schema,
  SavedReport,
} from './storage.interface';

// Database row types (snake_case from PostgreSQL)
interface DbUser {
  id: string;
  email: string;
  name: string;
  azure_oid?: string;
  role: 'admin' | 'user';
  created_at: Date;
  last_login?: Date;
}

interface DbConnection {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password_encrypted: string;
  description?: string;
  schema_file_id?: string;
  vector_store_id?: string;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

interface DbSchema {
  id: string;
  connection_id: string;
  schema_data: Schema;
  last_introspected?: Date;
  updated_at: Date;
}

interface DbReport {
  id: string;
  connection_id: string;
  owner_id: string;
  name: string;
  description?: string;
  natural_language_query: string;
  sql: string;
  explanation?: string;
  warnings: string[];
  confidence?: number;
  parameters?: any;
  is_favorite: boolean;
  is_shared: boolean;
  created_at: Date;
  last_modified: Date;
  last_run?: Date;
}

interface DbSuggestion {
  id: string;
  user_id: string;
  connection_id: string;
  suggestions: MetricSuggestion[];
  updated_at: Date;
}

// Helper to convert DB user to interface user
function toUser(row: DbUser): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    azureOid: row.azure_oid,
    role: row.role,
    createdAt: row.created_at.toISOString(),
    lastLogin: row.last_login?.toISOString(),
  };
}

// Helper to convert DB connection to interface connection
function toConnection(row: DbConnection): DatabaseConnection {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    host: row.host,
    port: row.port.toString(),
    database: row.database,
    username: row.username,
    password: decrypt(row.password_encrypted),
    description: row.description,
    schemaFileId: row.schema_file_id,
    vectorStoreId: row.vector_store_id,
    createdAt: row.created_at.toISOString(),
    status: 'disconnected',
  };
}

// Helper to convert DB report to interface report
function toReport(row: DbReport): SavedReport {
  return {
    id: row.id,
    connectionId: row.connection_id,
    name: row.name,
    description: row.description,
    naturalLanguageQuery: row.natural_language_query,
    sql: row.sql,
    explanation: row.explanation || '',
    warnings: row.warnings || [],
    confidence: row.confidence || 0,
    parameters: row.parameters,
    isFavorite: row.is_favorite,
    isShared: row.is_shared,
    createdBy: row.owner_id,
    createdAt: row.created_at.toISOString(),
    lastModified: row.last_modified.toISOString(),
    lastRun: row.last_run?.toISOString(),
  };
}

// Connection Storage Service
class PostgresConnectionStorageService implements IConnectionStorageService {
  async getConnections(userId?: string): Promise<DatabaseConnection[]> {
    const sql = getPool();

    if (!userId) {
      // Admin view - all connections
      const rows = await sql<DbConnection[]>`
        SELECT * FROM database_connections ORDER BY created_at DESC
      `;
      return rows.map(toConnection);
    }

    // User view - only connections they have access to
    const rows = await sql<DbConnection[]>`
      SELECT dc.* FROM database_connections dc
      INNER JOIN connection_permissions cp ON dc.id = cp.connection_id
      WHERE cp.user_id = ${userId}
      ORDER BY dc.created_at DESC
    `;
    return rows.map(toConnection);
  }

  async getConnection(id: string, userId?: string): Promise<DatabaseConnection | undefined> {
    const sql = getPool();

    if (!userId) {
      const rows = await sql<DbConnection[]>`
        SELECT * FROM database_connections WHERE id = ${id}
      `;
      return rows[0] ? toConnection(rows[0]) : undefined;
    }

    // Check user has access
    const rows = await sql<DbConnection[]>`
      SELECT dc.* FROM database_connections dc
      INNER JOIN connection_permissions cp ON dc.id = cp.connection_id
      WHERE dc.id = ${id} AND cp.user_id = ${userId}
    `;
    return rows[0] ? toConnection(rows[0]) : undefined;
  }

  async createConnection(connection: Omit<DatabaseConnection, 'id'>, userId?: string): Promise<DatabaseConnection> {
    const sql = getPool();
    const passwordEncrypted = encrypt(connection.password || '');

    const rows = await sql<DbConnection[]>`
      INSERT INTO database_connections (
        name, type, host, port, database, username, password_encrypted,
        description, schema_file_id, vector_store_id, created_by
      ) VALUES (
        ${connection.name},
        ${connection.type},
        ${connection.host},
        ${parseInt(connection.port || '5432', 10)},
        ${connection.database},
        ${connection.username},
        ${passwordEncrypted},
        ${connection.description || null},
        ${connection.schemaFileId || null},
        ${connection.vectorStoreId || null},
        ${userId || null}
      )
      RETURNING *
    `;

    return toConnection(rows[0]);
  }

  async updateConnection(id: string, updates: Partial<DatabaseConnection>, userId?: string): Promise<DatabaseConnection> {
    const sql = getPool();

    // Build update object
    const updateFields: Record<string, any> = {};
    if (updates.name !== undefined) updateFields.name = updates.name;
    if (updates.type !== undefined) updateFields.type = updates.type;
    if (updates.host !== undefined) updateFields.host = updates.host;
    if (updates.port !== undefined) updateFields.port = parseInt(updates.port, 10);
    if (updates.database !== undefined) updateFields.database = updates.database;
    if (updates.username !== undefined) updateFields.username = updates.username;
    if (updates.password !== undefined) updateFields.password_encrypted = encrypt(updates.password);
    if (updates.description !== undefined) updateFields.description = updates.description;
    if (updates.schemaFileId !== undefined) updateFields.schema_file_id = updates.schemaFileId;
    if (updates.vectorStoreId !== undefined) updateFields.vector_store_id = updates.vectorStoreId;

    const rows = await sql<DbConnection[]>`
      UPDATE database_connections
      SET ${sql(updateFields)}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!rows[0]) {
      throw new Error(`Connection ${id} not found`);
    }

    return toConnection(rows[0]);
  }

  async deleteConnection(id: string, userId?: string): Promise<void> {
    const sql = getPool();
    await sql`DELETE FROM database_connections WHERE id = ${id}`;
  }

  async importConnections(connections: DatabaseConnection[], userId?: string): Promise<void> {
    const sql = getPool();

    for (const connection of connections) {
      const passwordEncrypted = encrypt(connection.password || '');

      await sql`
        INSERT INTO database_connections (
          id, name, type, host, port, database, username, password_encrypted,
          description, schema_file_id, vector_store_id, created_by
        ) VALUES (
          ${connection.id},
          ${connection.name},
          ${connection.type},
          ${connection.host},
          ${parseInt(connection.port || '5432', 10)},
          ${connection.database},
          ${connection.username},
          ${passwordEncrypted},
          ${connection.description || null},
          ${connection.schemaFileId || null},
          ${connection.vectorStoreId || null},
          ${userId || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          host = EXCLUDED.host,
          port = EXCLUDED.port,
          database = EXCLUDED.database,
          username = EXCLUDED.username,
          password_encrypted = EXCLUDED.password_encrypted,
          description = EXCLUDED.description,
          schema_file_id = EXCLUDED.schema_file_id,
          vector_store_id = EXCLUDED.vector_store_id
      `;
    }
  }

  async getCurrentConnection(userId?: string): Promise<DatabaseConnection | undefined> {
    // In multi-user mode, current connection is handled client-side
    // This returns the first accessible connection as a default
    const connections = await this.getConnections(userId);
    return connections[0];
  }

  async setCurrentConnection(connection: DatabaseConnection, userId?: string): Promise<void> {
    // In multi-user mode, current connection is handled client-side
    // No server-side storage needed
  }
}

// Schema Storage Service
class PostgresSchemaStorageService implements ISchemaStorageService {
  async getSchema(connectionId: string): Promise<Schema | undefined> {
    const sql = getPool();
    const rows = await sql<DbSchema[]>`
      SELECT * FROM connection_schemas WHERE connection_id = ${connectionId}
    `;
    return rows[0]?.schema_data;
  }

  async getAllSchemas(): Promise<Schema[]> {
    const sql = getPool();
    const rows = await sql<DbSchema[]>`
      SELECT * FROM connection_schemas
    `;
    return rows.map(r => r.schema_data);
  }

  async setSchema(schema: Schema, userId?: string): Promise<void> {
    const sql = getPool();
    await sql`
      INSERT INTO connection_schemas (connection_id, schema_data, last_introspected)
      VALUES (${schema.connectionId}, ${JSON.stringify(schema)}, NOW())
      ON CONFLICT (connection_id) DO UPDATE SET
        schema_data = EXCLUDED.schema_data,
        last_introspected = NOW()
    `;
  }

  async updateTableDescription(connectionId: string, tableName: string, description: string, userId?: string): Promise<void> {
    const schema = await this.getSchema(connectionId);
    if (!schema) return;

    const table = schema.tables?.find(t => t.name === tableName);
    if (table) {
      table.aiDescription = description;
      await this.setSchema(schema, userId);
    }
  }

  async updateColumnDescription(connectionId: string, tableName: string, columnName: string, description: string, userId?: string): Promise<void> {
    const schema = await this.getSchema(connectionId);
    if (!schema) return;

    const table = schema.tables?.find(t => t.name === tableName);
    const column = table?.columns?.find(c => c.name === columnName);
    if (column) {
      column.aiDescription = description;
      await this.setSchema(schema, userId);
    }
  }

  async deleteSchema(connectionId: string): Promise<void> {
    const sql = getPool();
    await sql`DELETE FROM connection_schemas WHERE connection_id = ${connectionId}`;
  }
}

// Report Storage Service
class PostgresReportStorageService implements IReportStorageService {
  async getReports(userId?: string, connectionId?: string): Promise<SavedReport[]> {
    const sql = getPool();

    if (!userId) {
      // Admin view - all reports
      if (connectionId) {
        const rows = await sql<DbReport[]>`
          SELECT * FROM saved_reports WHERE connection_id = ${connectionId}
          ORDER BY last_modified DESC
        `;
        return rows.map(toReport);
      }
      const rows = await sql<DbReport[]>`
        SELECT * FROM saved_reports ORDER BY last_modified DESC
      `;
      return rows.map(toReport);
    }

    // User view - own reports + shared reports on accessible connections
    if (connectionId) {
      const rows = await sql<DbReport[]>`
        SELECT * FROM saved_reports
        WHERE connection_id = ${connectionId}
          AND (owner_id = ${userId} OR is_shared = true)
        ORDER BY last_modified DESC
      `;
      return rows.map(toReport);
    }

    const rows = await sql<DbReport[]>`
      SELECT sr.* FROM saved_reports sr
      INNER JOIN connection_permissions cp ON sr.connection_id = cp.connection_id
      WHERE cp.user_id = ${userId}
        AND (sr.owner_id = ${userId} OR sr.is_shared = true)
      ORDER BY sr.last_modified DESC
    `;
    return rows.map(toReport);
  }

  async getReport(id: string, userId?: string): Promise<SavedReport | undefined> {
    const sql = getPool();
    const rows = await sql<DbReport[]>`
      SELECT * FROM saved_reports WHERE id = ${id}
    `;
    return rows[0] ? toReport(rows[0]) : undefined;
  }

  async createReport(report: Omit<SavedReport, 'id'>, userId?: string): Promise<SavedReport> {
    const sql = getPool();

    const rows = await sql<DbReport[]>`
      INSERT INTO saved_reports (
        connection_id, owner_id, name, description,
        natural_language_query, sql, explanation,
        warnings, confidence, parameters, is_favorite
      ) VALUES (
        ${report.connectionId},
        ${userId || null},
        ${report.name},
        ${report.description || null},
        ${report.naturalLanguageQuery},
        ${report.sql},
        ${report.explanation || null},
        ${JSON.stringify(report.warnings || [])},
        ${report.confidence || null},
        ${report.parameters ? JSON.stringify(report.parameters) : null},
        ${report.isFavorite || false}
      )
      RETURNING *
    `;

    return toReport(rows[0]);
  }

  async updateReport(id: string, updates: Partial<SavedReport>, userId?: string): Promise<SavedReport> {
    const sql = getPool();

    const updateFields: Record<string, any> = {};
    if (updates.name !== undefined) updateFields.name = updates.name;
    if (updates.description !== undefined) updateFields.description = updates.description;
    if (updates.naturalLanguageQuery !== undefined) updateFields.natural_language_query = updates.naturalLanguageQuery;
    if (updates.sql !== undefined) updateFields.sql = updates.sql;
    if (updates.explanation !== undefined) updateFields.explanation = updates.explanation;
    if (updates.warnings !== undefined) updateFields.warnings = JSON.stringify(updates.warnings);
    if (updates.confidence !== undefined) updateFields.confidence = updates.confidence;
    if (updates.parameters !== undefined) updateFields.parameters = JSON.stringify(updates.parameters);
    if (updates.isFavorite !== undefined) updateFields.is_favorite = updates.isFavorite;

    const rows = await sql<DbReport[]>`
      UPDATE saved_reports
      SET ${sql(updateFields)}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!rows[0]) {
      throw new Error(`Report ${id} not found`);
    }

    return toReport(rows[0]);
  }

  async deleteReport(id: string, userId?: string): Promise<void> {
    const sql = getPool();
    await sql`DELETE FROM saved_reports WHERE id = ${id}`;
  }

  async cloneReport(id: string, userId?: string): Promise<SavedReport> {
    const original = await this.getReport(id);
    if (!original) {
      throw new Error(`Report ${id} not found`);
    }

    return this.createReport({
      ...original,
      name: `${original.name} (Copy)`,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      isFavorite: false,
    }, userId);
  }

  async toggleFavorite(id: string, userId?: string): Promise<SavedReport> {
    const sql = getPool();
    const rows = await sql<DbReport[]>`
      UPDATE saved_reports
      SET is_favorite = NOT is_favorite
      WHERE id = ${id}
      RETURNING *
    `;

    if (!rows[0]) {
      throw new Error(`Report ${id} not found`);
    }

    return toReport(rows[0]);
  }

  async updateLastRun(id: string, userId?: string): Promise<void> {
    const sql = getPool();
    await sql`
      UPDATE saved_reports SET last_run = NOW() WHERE id = ${id}
    `;
  }

  async shareReport(reportId: string, share: boolean, userId?: string): Promise<SavedReport> {
    const sql = getPool();
    const rows = await sql<DbReport[]>`
      UPDATE saved_reports SET is_shared = ${share} WHERE id = ${reportId}
      RETURNING *
    `;

    if (!rows[0]) {
      throw new Error(`Report ${reportId} not found`);
    }

    return toReport(rows[0]);
  }

  async getSharedReports(connectionId?: string, userId?: string): Promise<SavedReport[]> {
    const sql = getPool();

    if (!userId) {
      return [];
    }

    // Get shared reports from OTHER users on connections the user has access to
    if (connectionId) {
      const rows = await sql<DbReport[]>`
        SELECT * FROM saved_reports
        WHERE connection_id = ${connectionId}
          AND is_shared = true
          AND owner_id != ${userId}
        ORDER BY last_modified DESC
      `;
      return rows.map(toReport);
    }

    const rows = await sql<DbReport[]>`
      SELECT sr.* FROM saved_reports sr
      INNER JOIN connection_permissions cp ON sr.connection_id = cp.connection_id
      WHERE cp.user_id = ${userId}
        AND sr.is_shared = true
        AND sr.owner_id != ${userId}
      ORDER BY sr.last_modified DESC
    `;
    return rows.map(toReport);
  }

  async importReports(reports: SavedReport[], userId?: string): Promise<void> {
    for (const report of reports) {
      await this.createReport(report, userId);
    }
  }
}

// Suggestion Storage Service
class PostgresSuggestionStorageService implements ISuggestionStorageService {
  async getSuggestions(connectionId: string, userId?: string): Promise<MetricSuggestion[]> {
    const sql = getPool();

    if (!userId) {
      return [];
    }

    const rows = await sql<DbSuggestion[]>`
      SELECT * FROM user_suggestions
      WHERE user_id = ${userId} AND connection_id = ${connectionId}
    `;

    return rows[0]?.suggestions || [];
  }

  async setSuggestions(connectionId: string, suggestions: MetricSuggestion[], userId?: string): Promise<void> {
    if (!userId) return;

    const sql = getPool();
    await sql`
      INSERT INTO user_suggestions (user_id, connection_id, suggestions)
      VALUES (${userId}, ${connectionId}, ${JSON.stringify(suggestions)})
      ON CONFLICT (user_id, connection_id) DO UPDATE SET
        suggestions = EXCLUDED.suggestions
    `;
  }

  async addSuggestions(connectionId: string, newSuggestions: MetricSuggestion[], userId?: string): Promise<void> {
    const existing = await this.getSuggestions(connectionId, userId);
    await this.setSuggestions(connectionId, [...existing, ...newSuggestions], userId);
  }

  async removeSuggestion(connectionId: string, index: number, userId?: string): Promise<void> {
    const existing = await this.getSuggestions(connectionId, userId);
    existing.splice(index, 1);
    await this.setSuggestions(connectionId, existing, userId);
  }
}

// User Storage Service
class PostgresUserStorageService implements IUserStorageService {
  async getUser(id: string): Promise<User | undefined> {
    const sql = getPool();
    const rows = await sql<DbUser[]>`
      SELECT * FROM users WHERE id = ${id}
    `;
    return rows[0] ? toUser(rows[0]) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const sql = getPool();
    const rows = await sql<DbUser[]>`
      SELECT * FROM users WHERE email = ${email}
    `;
    return rows[0] ? toUser(rows[0]) : undefined;
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    const sql = getPool();

    // Check if this is the first user (should be admin)
    const isFirst = await this.isFirstUser();
    const role = isFirst ? 'admin' : user.role;

    const rows = await sql<DbUser[]>`
      INSERT INTO users (email, name, azure_oid, role)
      VALUES (${user.email}, ${user.name}, ${user.azureOid || null}, ${role})
      RETURNING *
    `;

    return toUser(rows[0]);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const sql = getPool();

    const updateFields: Record<string, any> = {};
    if (updates.email !== undefined) updateFields.email = updates.email;
    if (updates.name !== undefined) updateFields.name = updates.name;
    if (updates.role !== undefined) updateFields.role = updates.role;
    if (updates.lastLogin !== undefined) updateFields.last_login = new Date(updates.lastLogin);

    const rows = await sql<DbUser[]>`
      UPDATE users
      SET ${sql(updateFields)}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!rows[0]) {
      throw new Error(`User ${id} not found`);
    }

    return toUser(rows[0]);
  }

  async getAllUsers(): Promise<User[]> {
    const sql = getPool();
    const rows = await sql<DbUser[]>`
      SELECT * FROM users ORDER BY created_at DESC
    `;
    return rows.map(toUser);
  }

  async isFirstUser(): Promise<boolean> {
    const sql = getPool();
    const rows = await sql<{ count: string }[]>`
      SELECT COUNT(*) as count FROM users
    `;
    return parseInt(rows[0].count, 10) === 0;
  }

  async deleteUser(id: string): Promise<void> {
    const sql = getPool();
    await sql`DELETE FROM users WHERE id = ${id}`;
  }
}

// Permission Storage Service
class PostgresPermissionStorageService implements IPermissionStorageService {
  async grantConnectionAccess(connectionId: string, userId: string, grantedBy?: string): Promise<void> {
    const sql = getPool();
    await sql`
      INSERT INTO connection_permissions (connection_id, user_id, granted_by)
      VALUES (${connectionId}, ${userId}, ${grantedBy || null})
      ON CONFLICT (connection_id, user_id) DO NOTHING
    `;
  }

  async revokeConnectionAccess(connectionId: string, userId: string): Promise<void> {
    const sql = getPool();
    await sql`
      DELETE FROM connection_permissions
      WHERE connection_id = ${connectionId} AND user_id = ${userId}
    `;
  }

  async hasConnectionAccess(connectionId: string, userId: string): Promise<boolean> {
    const sql = getPool();

    // Check if user is admin (admins have access to all)
    const userRows = await sql<DbUser[]>`
      SELECT * FROM users WHERE id = ${userId}
    `;
    if (userRows[0]?.role === 'admin') {
      return true;
    }

    // Check explicit permission
    const rows = await sql<{ count: string }[]>`
      SELECT COUNT(*) as count FROM connection_permissions
      WHERE connection_id = ${connectionId} AND user_id = ${userId}
    `;
    return parseInt(rows[0].count, 10) > 0;
  }

  async getConnectionUsers(connectionId: string): Promise<User[]> {
    const sql = getPool();
    const rows = await sql<DbUser[]>`
      SELECT u.* FROM users u
      INNER JOIN connection_permissions cp ON u.id = cp.user_id
      WHERE cp.connection_id = ${connectionId}
      ORDER BY u.name
    `;
    return rows.map(toUser);
  }

  async getUserConnections(userId: string): Promise<DatabaseConnection[]> {
    const sql = getPool();

    // Check if user is admin
    const userRows = await sql<DbUser[]>`
      SELECT * FROM users WHERE id = ${userId}
    `;
    if (userRows[0]?.role === 'admin') {
      // Admins see all connections
      const rows = await sql<DbConnection[]>`
        SELECT * FROM database_connections ORDER BY created_at DESC
      `;
      return rows.map(toConnection);
    }

    // Regular users see only permitted connections
    const rows = await sql<DbConnection[]>`
      SELECT dc.* FROM database_connections dc
      INNER JOIN connection_permissions cp ON dc.id = cp.connection_id
      WHERE cp.user_id = ${userId}
      ORDER BY dc.created_at DESC
    `;
    return rows.map(toConnection);
  }
}

// Notification Storage Service
class PostgresNotificationStorageService implements INotificationStorageService {
  async getDismissedNotifications(userId?: string): Promise<string[]> {
    if (!userId) return [];

    const sql = getPool();
    const rows = await sql<{ notification_id: string }[]>`
      SELECT notification_id FROM dismissed_notifications WHERE user_id = ${userId}
    `;
    return rows.map(r => r.notification_id);
  }

  async dismissNotification(notificationId: string, userId?: string): Promise<void> {
    if (!userId) return;

    const sql = getPool();
    await sql`
      INSERT INTO dismissed_notifications (user_id, notification_id)
      VALUES (${userId}, ${notificationId})
      ON CONFLICT (user_id, notification_id) DO NOTHING
    `;
  }

  async clearDismissedNotifications(userId?: string): Promise<void> {
    if (!userId) return;

    const sql = getPool();
    await sql`DELETE FROM dismissed_notifications WHERE user_id = ${userId}`;
  }
}

// Main PostgreSQL Storage Service
export function createPostgresStorageService(): IStorageService {
  return {
    connections: new PostgresConnectionStorageService(),
    schemas: new PostgresSchemaStorageService(),
    reports: new PostgresReportStorageService(),
    suggestions: new PostgresSuggestionStorageService(),
    users: new PostgresUserStorageService(),
    permissions: new PostgresPermissionStorageService(),
    notifications: new PostgresNotificationStorageService(),
    isMultiUserEnabled: () => true,
  };
}
