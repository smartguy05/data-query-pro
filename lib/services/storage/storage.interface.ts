/**
 * Storage Service Interfaces
 *
 * These interfaces define the contract for data persistence.
 * Implementations can use localStorage (single-user) or PostgreSQL (multi-user).
 */

// Re-export existing types for convenience
export type { SavedReport, ReportParameter } from '@/models/saved-report.interface';
export type { DatabaseConnection } from '@/models/database-connection.interface';
export type { Schema } from '@/models/schema.interface';
export type { DatabaseTable } from '@/models/database-table.interface';
export type { Column } from '@/models/column.interface';

// User model for multi-user mode
export interface User {
  id: string;
  email: string;
  name: string;
  azureOid?: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastLogin?: string;
}

// Metric suggestion interface (moved from app/page.tsx)
export interface MetricSuggestion {
  title: string;
  description: string;
  query: string;
  category: string;
  relevantTables?: string[];
}

// Connection storage operations
export interface IConnectionStorageService {
  /** Get all connections (optionally filtered by user access in multi-user mode) */
  getConnections(userId?: string): Promise<DatabaseConnection[]>;

  /** Get a specific connection by ID */
  getConnection(id: string, userId?: string): Promise<DatabaseConnection | undefined>;

  /** Create a new connection */
  createConnection(connection: Omit<DatabaseConnection, 'id'>, userId?: string): Promise<DatabaseConnection>;

  /** Update an existing connection */
  updateConnection(id: string, updates: Partial<DatabaseConnection>, userId?: string): Promise<DatabaseConnection>;

  /** Delete a connection */
  deleteConnection(id: string, userId?: string): Promise<void>;

  /** Import multiple connections */
  importConnections(connections: DatabaseConnection[], userId?: string): Promise<void>;

  /** Get the current/active connection */
  getCurrentConnection(userId?: string): Promise<DatabaseConnection | undefined>;

  /** Set the current/active connection */
  setCurrentConnection(connection: DatabaseConnection, userId?: string): Promise<void>;
}

// Schema storage operations
export interface ISchemaStorageService {
  /** Get schema for a connection */
  getSchema(connectionId: string): Promise<Schema | undefined>;

  /** Get all schemas */
  getAllSchemas(): Promise<Schema[]>;

  /** Save or update a schema */
  setSchema(schema: Schema, userId?: string): Promise<void>;

  /** Update a table description */
  updateTableDescription(connectionId: string, tableName: string, description: string, userId?: string): Promise<void>;

  /** Update a column description */
  updateColumnDescription(connectionId: string, tableName: string, columnName: string, description: string, userId?: string): Promise<void>;

  /** Delete schema for a connection */
  deleteSchema(connectionId: string): Promise<void>;
}

// Report storage operations
export interface IReportStorageService {
  /** Get all reports for a user (includes shared reports in multi-user mode) */
  getReports(userId?: string, connectionId?: string): Promise<SavedReport[]>;

  /** Get a specific report */
  getReport(id: string, userId?: string): Promise<SavedReport | undefined>;

  /** Create a new report */
  createReport(report: Omit<SavedReport, 'id'>, userId?: string): Promise<SavedReport>;

  /** Update an existing report */
  updateReport(id: string, updates: Partial<SavedReport>, userId?: string): Promise<SavedReport>;

  /** Delete a report */
  deleteReport(id: string, userId?: string): Promise<void>;

  /** Clone a report */
  cloneReport(id: string, userId?: string): Promise<SavedReport>;

  /** Toggle favorite status */
  toggleFavorite(id: string, userId?: string): Promise<SavedReport>;

  /** Update last run timestamp */
  updateLastRun(id: string, userId?: string): Promise<void>;

  /** Toggle share status of a report */
  shareReport(reportId: string, share: boolean, userId?: string): Promise<SavedReport>;

  /** Get shared reports from other users (multi-user mode only) */
  getSharedReports(connectionId?: string, userId?: string): Promise<SavedReport[]>;
}

// Suggestion storage operations
export interface ISuggestionStorageService {
  /** Get suggestions for a connection */
  getSuggestions(connectionId: string, userId?: string): Promise<MetricSuggestion[]>;

  /** Save suggestions for a connection */
  setSuggestions(connectionId: string, suggestions: MetricSuggestion[], userId?: string): Promise<void>;

  /** Add suggestions to existing ones */
  addSuggestions(connectionId: string, suggestions: MetricSuggestion[], userId?: string): Promise<void>;

  /** Remove a suggestion by index */
  removeSuggestion(connectionId: string, index: number, userId?: string): Promise<void>;
}

// User storage operations (multi-user mode only, stub in localStorage mode)
export interface IUserStorageService {
  /** Get a user by ID */
  getUser(id: string): Promise<User | undefined>;

  /** Get a user by email */
  getUserByEmail(email: string): Promise<User | undefined>;

  /** Create a new user */
  createUser(user: Omit<User, 'id'>): Promise<User>;

  /** Update a user */
  updateUser(id: string, updates: Partial<User>): Promise<User>;

  /** Get all users */
  getAllUsers(): Promise<User[]>;

  /** Check if this is the first user (for auto-admin assignment) */
  isFirstUser(): Promise<boolean>;

  /** Delete a user */
  deleteUser(id: string): Promise<void>;
}

// Permission storage operations (multi-user mode only)
export interface IPermissionStorageService {
  /** Grant a user access to a connection */
  grantConnectionAccess(connectionId: string, userId: string, grantedBy?: string): Promise<void>;

  /** Revoke a user's access to a connection */
  revokeConnectionAccess(connectionId: string, userId: string): Promise<void>;

  /** Check if a user has access to a connection */
  hasConnectionAccess(connectionId: string, userId: string): Promise<boolean>;

  /** Get all users with access to a connection */
  getConnectionUsers(connectionId: string): Promise<User[]>;

  /** Get all connections a user has access to */
  getUserConnections(userId: string): Promise<DatabaseConnection[]>;
}

// Notification storage operations
export interface INotificationStorageService {
  /** Get dismissed notification IDs */
  getDismissedNotifications(userId?: string): Promise<string[]>;

  /** Dismiss a notification */
  dismissNotification(notificationId: string, userId?: string): Promise<void>;

  /** Clear all dismissed notifications */
  clearDismissedNotifications(userId?: string): Promise<void>;
}

// Unified storage service interface
export interface IStorageService {
  connections: IConnectionStorageService;
  schemas: ISchemaStorageService;
  reports: IReportStorageService;
  suggestions: ISuggestionStorageService;
  users: IUserStorageService;
  permissions: IPermissionStorageService;
  notifications: INotificationStorageService;

  /** Check if multi-user mode is enabled */
  isMultiUserEnabled(): boolean;
}
