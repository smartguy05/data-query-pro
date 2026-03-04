import type { SavedReport } from '@/models/saved-report.interface';

export interface StorageProvider {
  getConnections(): Promise<DatabaseConnection[]>;
  addConnection(conn: DatabaseConnection): Promise<void>;
  updateConnection(conn: DatabaseConnection): Promise<void>;
  deleteConnection(id: string): Promise<void>;
  duplicateConnection(id: string): Promise<DatabaseConnection | null>;
  importConnections(conns: DatabaseConnection[]): Promise<void>;

  getCurrentConnectionId(): Promise<string | null>;
  setCurrentConnectionId(id: string | null): Promise<void>;

  getSchemas(): Promise<Schema[]>;
  setSchema(schema: Schema): Promise<void>;

  getReports(): Promise<SavedReport[]>;
  saveReport(report: SavedReport): Promise<void>;
  updateReport(report: SavedReport): Promise<void>;
  deleteReport(id: string): Promise<void>;

  getSuggestions(connectionId: string): Promise<unknown[] | null>;
  setSuggestions(connectionId: string, suggestions: unknown[]): Promise<void>;

  getDismissedNotifications(): Promise<string[]>;
  dismissNotification(id: string): Promise<void>;
}
