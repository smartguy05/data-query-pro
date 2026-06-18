import type { DatabaseConnection } from '@/models/database-connection.interface';
import type { Schema } from '@/models/schema.interface';
import type { SavedReport } from '@/models/saved-report.interface';
import type { QueryHistoryEntry } from '@/models/query-history.interface';
import type { QueryAccuracyStats } from '@/models/query-accuracy.interface';

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

  // Query history is device-local convenience data (localStorage in both modes).
  getQueryHistory(): Promise<QueryHistoryEntry[]>;
  addQueryHistory(entry: QueryHistoryEntry): Promise<void>;
  deleteQueryHistory(id: string): Promise<void>;
  clearQueryHistory(): Promise<void>;

  getSuggestions(connectionId: string): Promise<unknown[] | null>;
  setSuggestions(connectionId: string, suggestions: unknown[]): Promise<void>;

  // Query accuracy: a global per-user running tally. Mutated via deltas so the
  // auth-mode update can be a single atomic SQL statement (no read-modify-write race).
  getQueryAccuracy(): Promise<QueryAccuracyStats>;
  applyQueryAccuracyDelta(totalDelta: number, successfulDelta: number): Promise<void>;

  getDismissedNotifications(): Promise<string[]>;
  dismissNotification(id: string): Promise<void>;
}
