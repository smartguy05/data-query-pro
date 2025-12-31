/**
 * localStorage Storage Adapter
 *
 * Implements all storage interfaces using browser localStorage.
 * This is the default adapter for single-user mode.
 */

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
} from './storage.interface';
import type { DatabaseConnection } from '@/models/database-connection.interface';
import type { Schema } from '@/models/schema.interface';
import type { SavedReport } from '@/models/saved-report.interface';

// localStorage keys
const KEYS = {
  CONNECTIONS: 'databaseConnections',
  CURRENT_CONNECTION: 'currentDbConnection',
  SCHEMAS: 'connectionSchemas',
  REPORTS: 'saved_reports',
  SUGGESTIONS_PREFIX: 'suggestions_',
  DISMISSED_NOTIFICATIONS: 'dismissed_notifications',
} as const;

// Helper to safely parse JSON from localStorage
function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// Helper to check if we're in browser environment
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Connection Storage using localStorage
 */
class LocalStorageConnectionService implements IConnectionStorageService {
  async getConnections(): Promise<DatabaseConnection[]> {
    if (!isBrowser()) return [];
    return safeJsonParse(localStorage.getItem(KEYS.CONNECTIONS), []);
  }

  async getConnection(id: string): Promise<DatabaseConnection | undefined> {
    const connections = await this.getConnections();
    return connections.find(c => c.id === id);
  }

  async createConnection(connection: Omit<DatabaseConnection, 'id'>): Promise<DatabaseConnection> {
    if (!isBrowser()) throw new Error('localStorage not available');

    const newConnection: DatabaseConnection = {
      ...connection,
      id: crypto.randomUUID(),
    } as DatabaseConnection;

    const connections = await this.getConnections();
    connections.push(newConnection);
    localStorage.setItem(KEYS.CONNECTIONS, JSON.stringify(connections));

    return newConnection;
  }

  async updateConnection(id: string, updates: Partial<DatabaseConnection>): Promise<DatabaseConnection> {
    if (!isBrowser()) throw new Error('localStorage not available');

    const connections = await this.getConnections();
    const index = connections.findIndex(c => c.id === id);

    if (index === -1) throw new Error(`Connection ${id} not found`);

    connections[index] = { ...connections[index], ...updates };
    localStorage.setItem(KEYS.CONNECTIONS, JSON.stringify(connections));

    // Also update current connection if it's the same one
    const current = await this.getCurrentConnection();
    if (current?.id === id) {
      await this.setCurrentConnection(connections[index]);
    }

    return connections[index];
  }

  async deleteConnection(id: string): Promise<void> {
    if (!isBrowser()) return;

    const connections = await this.getConnections();
    const filtered = connections.filter(c => c.id !== id);
    localStorage.setItem(KEYS.CONNECTIONS, JSON.stringify(filtered));

    // Clear current if deleted
    const current = await this.getCurrentConnection();
    if (current?.id === id) {
      localStorage.removeItem(KEYS.CURRENT_CONNECTION);
    }
  }

  async importConnections(connections: DatabaseConnection[]): Promise<void> {
    if (!isBrowser()) return;

    const existing = await this.getConnections();
    const merged = [...existing, ...connections];
    localStorage.setItem(KEYS.CONNECTIONS, JSON.stringify(merged));
  }

  async getCurrentConnection(): Promise<DatabaseConnection | undefined> {
    if (!isBrowser()) return undefined;
    return safeJsonParse(localStorage.getItem(KEYS.CURRENT_CONNECTION), undefined);
  }

  async setCurrentConnection(connection: DatabaseConnection): Promise<void> {
    if (!isBrowser()) return;
    localStorage.setItem(KEYS.CURRENT_CONNECTION, JSON.stringify(connection));
  }
}

/**
 * Schema Storage using localStorage
 */
class LocalStorageSchemaService implements ISchemaStorageService {
  async getSchema(connectionId: string): Promise<Schema | undefined> {
    const schemas = await this.getAllSchemas();
    return schemas.find(s => s.connectionId === connectionId);
  }

  async getAllSchemas(): Promise<Schema[]> {
    if (!isBrowser()) return [];
    return safeJsonParse(localStorage.getItem(KEYS.SCHEMAS), []);
  }

  async setSchema(schema: Schema): Promise<void> {
    if (!isBrowser()) return;

    const schemas = await this.getAllSchemas();
    const index = schemas.findIndex(s => s.connectionId === schema.connectionId);

    if (index >= 0) {
      schemas[index] = schema;
    } else {
      schemas.push(schema);
    }

    localStorage.setItem(KEYS.SCHEMAS, JSON.stringify(schemas));
  }

  async updateTableDescription(connectionId: string, tableName: string, description: string): Promise<void> {
    const schema = await this.getSchema(connectionId);
    if (!schema) throw new Error(`Schema for connection ${connectionId} not found`);

    const table = schema.tables.find(t => t.name === tableName);
    if (!table) throw new Error(`Table ${tableName} not found`);

    table.aiDescription = description;
    await this.setSchema(schema);
  }

  async updateColumnDescription(connectionId: string, tableName: string, columnName: string, description: string): Promise<void> {
    const schema = await this.getSchema(connectionId);
    if (!schema) throw new Error(`Schema for connection ${connectionId} not found`);

    const table = schema.tables.find(t => t.name === tableName);
    if (!table) throw new Error(`Table ${tableName} not found`);

    const column = table.columns.find(c => c.name === columnName);
    if (!column) throw new Error(`Column ${columnName} not found`);

    column.aiDescription = description;
    await this.setSchema(schema);
  }

  async deleteSchema(connectionId: string): Promise<void> {
    if (!isBrowser()) return;

    const schemas = await this.getAllSchemas();
    const filtered = schemas.filter(s => s.connectionId !== connectionId);
    localStorage.setItem(KEYS.SCHEMAS, JSON.stringify(filtered));
  }
}

/**
 * Report Storage using localStorage
 */
class LocalStorageReportService implements IReportStorageService {
  async getReports(_userId?: string, connectionId?: string): Promise<SavedReport[]> {
    if (!isBrowser()) return [];

    let reports = safeJsonParse<SavedReport[]>(localStorage.getItem(KEYS.REPORTS), []);

    if (connectionId) {
      reports = reports.filter(r => r.connectionId === connectionId);
    }

    return reports;
  }

  async getReport(id: string): Promise<SavedReport | undefined> {
    const reports = await this.getReports();
    return reports.find(r => r.id === id);
  }

  async createReport(report: Omit<SavedReport, 'id'>): Promise<SavedReport> {
    if (!isBrowser()) throw new Error('localStorage not available');

    const newReport: SavedReport = {
      ...report,
      id: crypto.randomUUID(),
    };

    const reports = await this.getReports();
    reports.push(newReport);
    localStorage.setItem(KEYS.REPORTS, JSON.stringify(reports));

    return newReport;
  }

  async updateReport(id: string, updates: Partial<SavedReport>): Promise<SavedReport> {
    if (!isBrowser()) throw new Error('localStorage not available');

    const reports = await this.getReports();
    const index = reports.findIndex(r => r.id === id);

    if (index === -1) throw new Error(`Report ${id} not found`);

    reports[index] = { ...reports[index], ...updates, lastModified: new Date().toISOString() };
    localStorage.setItem(KEYS.REPORTS, JSON.stringify(reports));

    return reports[index];
  }

  async deleteReport(id: string): Promise<void> {
    if (!isBrowser()) return;

    const reports = await this.getReports();
    const filtered = reports.filter(r => r.id !== id);
    localStorage.setItem(KEYS.REPORTS, JSON.stringify(filtered));
  }

  async cloneReport(id: string): Promise<SavedReport> {
    const original = await this.getReport(id);
    if (!original) throw new Error(`Report ${id} not found`);

    const cloned: Omit<SavedReport, 'id'> = {
      ...original,
      name: `${original.name} (Copy)`,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      lastRun: undefined,
      isFavorite: false,
    };

    return this.createReport(cloned);
  }

  async toggleFavorite(id: string): Promise<SavedReport> {
    const report = await this.getReport(id);
    if (!report) throw new Error(`Report ${id} not found`);

    return this.updateReport(id, { isFavorite: !report.isFavorite });
  }

  async updateLastRun(id: string): Promise<void> {
    await this.updateReport(id, { lastRun: new Date().toISOString() });
  }

  async shareReport(reportId: string, share: boolean): Promise<SavedReport> {
    // In single-user mode, sharing is a no-op but we still update the flag
    return this.updateReport(reportId, { isShared: share });
  }

  async getSharedReports(_connectionId?: string, _userId?: string): Promise<SavedReport[]> {
    // In single-user mode, there are no shared reports from other users
    return [];
  }
}

/**
 * Suggestion Storage using localStorage
 */
class LocalStorageSuggestionService implements ISuggestionStorageService {
  private getKey(connectionId: string): string {
    return `${KEYS.SUGGESTIONS_PREFIX}${connectionId}`;
  }

  async getSuggestions(connectionId: string): Promise<MetricSuggestion[]> {
    if (!isBrowser()) return [];
    return safeJsonParse(localStorage.getItem(this.getKey(connectionId)), []);
  }

  async setSuggestions(connectionId: string, suggestions: MetricSuggestion[]): Promise<void> {
    if (!isBrowser()) return;
    localStorage.setItem(this.getKey(connectionId), JSON.stringify(suggestions));
  }

  async addSuggestions(connectionId: string, suggestions: MetricSuggestion[]): Promise<void> {
    const existing = await this.getSuggestions(connectionId);
    await this.setSuggestions(connectionId, [...existing, ...suggestions]);
  }

  async removeSuggestion(connectionId: string, index: number): Promise<void> {
    const suggestions = await this.getSuggestions(connectionId);
    suggestions.splice(index, 1);
    await this.setSuggestions(connectionId, suggestions);
  }
}

/**
 * User Storage stub for localStorage (single-user mode)
 * Returns a mock admin user since there's no real user management in single-user mode.
 */
class LocalStorageUserService implements IUserStorageService {
  private readonly mockUser: User = {
    id: 'local-user',
    email: 'local@localhost',
    name: 'Local User',
    role: 'admin',
    createdAt: new Date().toISOString(),
  };

  async getUser(_id: string): Promise<User | undefined> {
    return this.mockUser;
  }

  async getUserByEmail(_email: string): Promise<User | undefined> {
    return this.mockUser;
  }

  async createUser(_user: Omit<User, 'id'>): Promise<User> {
    return this.mockUser;
  }

  async updateUser(_id: string, _updates: Partial<User>): Promise<User> {
    return this.mockUser;
  }

  async getAllUsers(): Promise<User[]> {
    return [this.mockUser];
  }

  async isFirstUser(): Promise<boolean> {
    return false; // Always return false since single-user mode doesn't need first-user logic
  }

  async deleteUser(_id: string): Promise<void> {
    // No-op in single-user mode
  }
}

/**
 * Permission Storage stub for localStorage (single-user mode)
 * Always returns true for permissions since there's no access control in single-user mode.
 */
class LocalStoragePermissionService implements IPermissionStorageService {
  private readonly userService = new LocalStorageUserService();
  private readonly connectionService = new LocalStorageConnectionService();

  async grantConnectionAccess(_connectionId: string, _userId: string): Promise<void> {
    // No-op in single-user mode
  }

  async revokeConnectionAccess(_connectionId: string, _userId: string): Promise<void> {
    // No-op in single-user mode
  }

  async hasConnectionAccess(_connectionId: string, _userId: string): Promise<boolean> {
    return true; // Always has access in single-user mode
  }

  async getConnectionUsers(_connectionId: string): Promise<User[]> {
    return this.userService.getAllUsers();
  }

  async getUserConnections(_userId: string): Promise<DatabaseConnection[]> {
    return this.connectionService.getConnections();
  }
}

/**
 * Notification Storage using localStorage
 */
class LocalStorageNotificationService implements INotificationStorageService {
  async getDismissedNotifications(): Promise<string[]> {
    if (!isBrowser()) return [];
    return safeJsonParse(localStorage.getItem(KEYS.DISMISSED_NOTIFICATIONS), []);
  }

  async dismissNotification(notificationId: string): Promise<void> {
    if (!isBrowser()) return;

    const dismissed = await this.getDismissedNotifications();
    if (!dismissed.includes(notificationId)) {
      dismissed.push(notificationId);
      localStorage.setItem(KEYS.DISMISSED_NOTIFICATIONS, JSON.stringify(dismissed));
    }
  }

  async clearDismissedNotifications(): Promise<void> {
    if (!isBrowser()) return;
    localStorage.removeItem(KEYS.DISMISSED_NOTIFICATIONS);
  }
}

/**
 * Create the complete localStorage storage service
 */
export function createLocalStorageService(): IStorageService {
  return {
    connections: new LocalStorageConnectionService(),
    schemas: new LocalStorageSchemaService(),
    reports: new LocalStorageReportService(),
    suggestions: new LocalStorageSuggestionService(),
    users: new LocalStorageUserService(),
    permissions: new LocalStoragePermissionService(),
    notifications: new LocalStorageNotificationService(),
    isMultiUserEnabled: () => false,
  };
}
