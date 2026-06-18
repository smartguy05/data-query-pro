import type { StorageProvider } from './storage-provider';
import type { DatabaseConnection } from '@/models/database-connection.interface';
import type { Schema } from '@/models/schema.interface';
import type { SavedReport } from '@/models/saved-report.interface';
import type { QueryHistoryEntry } from '@/models/query-history.interface';
import type { QueryAccuracyStats } from '@/models/query-accuracy.interface';
import type { QueryCorrection } from '@/models/query-correction.interface';
import {
  getCorrectionsForFingerprint as localGetCorrections,
  addQueryCorrection as localAddCorrection,
  updateQueryCorrection as localUpdateCorrection,
  deleteQueryCorrection as localDeleteCorrection,
} from '@/utils/query-corrections';
import { HISTORY, STORAGE_KEYS } from '@/lib/constants';

export class LocalStorageProvider implements StorageProvider {
  private serverConnections: DatabaseConnection[] = [];
  private serverSchemas: Schema[] = [];
  private serverReports: SavedReport[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const response = await fetch('/api/config/connections');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.connections) {
          this.serverConnections = data.connections;
        }
        if (data.schemaData) {
          this.serverSchemas = Object.values(data.schemaData) as Schema[];
        }
        if (data.currentConnection) {
          // Only use server current if no local one
          const local = localStorage.getItem('currentDbConnection');
          if (!local || local === 'null') {
            localStorage.setItem('currentDbConnection', JSON.stringify(data.currentConnection));
          }
        }
        if (data.savedReports && Array.isArray(data.savedReports)) {
          const existingReports = JSON.parse(localStorage.getItem('saved_reports') || '[]');
          if (existingReports.length === 0) {
            localStorage.setItem('saved_reports', JSON.stringify(data.savedReports));
          }
        }
      }
    } catch (error) {
      console.error('Failed to load server config:', error);
    }

    // Load shared reports from config/reports.json (always-present, read-only).
    // These are merged fresh on every load and never persisted to localStorage.
    try {
      const reportsResponse = await fetch('/api/config/reports');
      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json();
        if (reportsData.success && Array.isArray(reportsData.reports)) {
          this.serverReports = reportsData.reports;
        }
      }
    } catch (error) {
      console.error('Failed to load server reports config:', error);
    }

    this.initialized = true;
  }

  async getConnections(): Promise<DatabaseConnection[]> {
    await this.initialize();

    const storedConnections: DatabaseConnection[] = JSON.parse(
      localStorage.getItem('databaseConnections') || '[]'
    );
    const localConnections = storedConnections.map(conn => ({
      ...conn,
      source: conn.source || ('local' as const),
    }));

    return [...this.serverConnections, ...localConnections];
  }

  async addConnection(conn: DatabaseConnection): Promise<void> {
    const stored: DatabaseConnection[] = JSON.parse(
      localStorage.getItem('databaseConnections') || '[]'
    );
    stored.push(conn);
    localStorage.setItem('databaseConnections', JSON.stringify(stored));
  }

  async updateConnection(conn: DatabaseConnection): Promise<void> {
    const stored: DatabaseConnection[] = JSON.parse(
      localStorage.getItem('databaseConnections') || '[]'
    );
    const updated = stored.map(c => (c.id === conn.id ? { ...c, ...conn } : c));
    localStorage.setItem('databaseConnections', JSON.stringify(updated));
  }

  async deleteConnection(id: string): Promise<void> {
    const stored: DatabaseConnection[] = JSON.parse(
      localStorage.getItem('databaseConnections') || '[]'
    );
    localStorage.setItem(
      'databaseConnections',
      JSON.stringify(stored.filter(c => c.id !== id))
    );
  }

  async duplicateConnection(id: string): Promise<DatabaseConnection | null> {
    const allConnections = await this.getConnections();
    const original = allConnections.find(c => c.id === id);
    if (!original) return null;

    const newId = Date.now().toString();
    const isServerConnection = original.source === 'server';

    const newConnection: DatabaseConnection = {
      ...original,
      id: newId,
      name: `${original.name} (Copy)`,
      schemaFileId: undefined,
      vectorStoreId: undefined,
      status: 'disconnected',
      source: 'local',
      createdAt: new Date().toISOString(),
      ...(isServerConnection && {
        host: '',
        port:
          original.type === 'postgresql'
            ? '5432'
            : original.type === 'mysql'
              ? '3306'
              : original.type === 'sqlserver'
                ? '1433'
                : '',
        database: '',
        username: '',
        password: '',
      }),
    };

    // Duplicate schema
    const schemas = await this.getSchemas();
    const originalSchema = schemas.find(s => s.connectionId === id);
    if (originalSchema) {
      const newSchema: Schema = {
        connectionId: newId,
        tables: originalSchema.tables.map(table => ({
          ...table,
          columns: table.columns.map(col => ({ ...col })),
        })),
      };
      await this.setSchema(newSchema);
    }

    // Duplicate reports
    const reports = await this.getReports();
    const originalReports = reports.filter(r => r.connectionId === id);
    for (const report of originalReports) {
      const newReport = {
        ...report,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        connectionId: newId,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        lastRun: undefined,
      };
      await this.saveReport(newReport);
    }

    // Copy suggestions
    const suggestions = localStorage.getItem(`suggestions_${id}`);
    if (suggestions) {
      localStorage.setItem(`suggestions_${newId}`, suggestions);
    }

    await this.addConnection(newConnection);
    return newConnection;
  }

  async importConnections(conns: DatabaseConnection[]): Promise<void> {
    const stored: DatabaseConnection[] = JSON.parse(
      localStorage.getItem('databaseConnections') || '[]'
    );
    stored.push(...conns);
    localStorage.setItem('databaseConnections', JSON.stringify(stored));
  }

  async getCurrentConnectionId(): Promise<string | null> {
    const stored = localStorage.getItem('currentDbConnection');
    if (!stored || stored === 'null') return null;
    try {
      const conn = JSON.parse(stored);
      return conn?.id || null;
    } catch {
      return null;
    }
  }

  async setCurrentConnectionId(id: string | null): Promise<void> {
    if (!id) {
      localStorage.removeItem('currentDbConnection');
      return;
    }
    const allConnections = await this.getConnections();
    const conn = allConnections.find(c => c.id === id);
    if (conn) {
      localStorage.setItem('currentDbConnection', JSON.stringify(conn));
    }
  }

  async getSchemas(): Promise<Schema[]> {
    await this.initialize();
    const storedSchemas: Schema[] = JSON.parse(
      localStorage.getItem('connectionSchemas') || '[]'
    );
    const serverSchemaIds = new Set(this.serverSchemas.map(s => s.connectionId));
    const localOnlySchemas = storedSchemas.filter(s => !serverSchemaIds.has(s.connectionId));
    return [...this.serverSchemas, ...localOnlySchemas];
  }

  async setSchema(schema: Schema): Promise<void> {
    const stored: Schema[] = JSON.parse(
      localStorage.getItem('connectionSchemas') || '[]'
    );
    const existing = stored.findIndex(s => s.connectionId === schema.connectionId);
    if (existing >= 0) {
      stored[existing] = schema;
    } else {
      stored.push(schema);
    }
    localStorage.setItem('connectionSchemas', JSON.stringify(stored));
  }

  async getReports(): Promise<SavedReport[]> {
    await this.initialize();
    const localReports: SavedReport[] = JSON.parse(
      localStorage.getItem('saved_reports') || '[]'
    ).map((r: SavedReport) => ({ ...r, source: r.source || ('local' as const) }));

    // Server reports take precedence over any local report with the same id.
    const serverReportIds = new Set(this.serverReports.map(r => r.id));
    const localOnlyReports = localReports.filter(r => !serverReportIds.has(r.id));
    return [...this.serverReports, ...localOnlyReports];
  }

  async saveReport(report: SavedReport): Promise<void> {
    // Never persist server reports to localStorage.
    if (report.source === 'server') return;
    const reports: SavedReport[] = JSON.parse(
      localStorage.getItem('saved_reports') || '[]'
    );
    reports.push(report);
    localStorage.setItem('saved_reports', JSON.stringify(reports));
  }

  async updateReport(report: SavedReport): Promise<void> {
    // Server reports are read-only.
    if (report.source === 'server') return;
    const reports: SavedReport[] = JSON.parse(
      localStorage.getItem('saved_reports') || '[]'
    );
    const updated = reports.map(r => (r.id === report.id ? report : r));
    localStorage.setItem('saved_reports', JSON.stringify(updated));
  }

  async deleteReport(id: string): Promise<void> {
    // Server reports cannot be deleted; only local reports are stored here, so
    // filtering by id is naturally a no-op for server reports.
    const reports: SavedReport[] = JSON.parse(
      localStorage.getItem('saved_reports') || '[]'
    );
    localStorage.setItem(
      'saved_reports',
      JSON.stringify(reports.filter(r => r.id !== id))
    );
  }

  async getQueryHistory(): Promise<QueryHistoryEntry[]> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.QUERY_HISTORY) || '[]');
    } catch {
      return [];
    }
  }

  async addQueryHistory(entry: QueryHistoryEntry): Promise<void> {
    const existing = await this.getQueryHistory();
    // Newest first, capped to a bounded ring buffer so localStorage never grows unbounded.
    const next = [entry, ...existing].slice(0, HISTORY.MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEYS.QUERY_HISTORY, JSON.stringify(next));
  }

  async deleteQueryHistory(id: string): Promise<void> {
    const existing = await this.getQueryHistory();
    localStorage.setItem(
      STORAGE_KEYS.QUERY_HISTORY,
      JSON.stringify(existing.filter(e => e.id !== id))
    );
  }

  async clearQueryHistory(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.QUERY_HISTORY);
  }

  async getSuggestions(connectionId: string): Promise<unknown[] | null> {
    const stored = localStorage.getItem(`suggestions_${connectionId}`);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  async setSuggestions(connectionId: string, suggestions: unknown[]): Promise<void> {
    localStorage.setItem(`suggestions_${connectionId}`, JSON.stringify(suggestions));
  }

  async getQueryAccuracy(): Promise<QueryAccuracyStats> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.QUERY_ACCURACY);
      if (!stored) return { total: 0, successful: 0 };
      const parsed = JSON.parse(stored) as Partial<QueryAccuracyStats>;
      return {
        total: Math.max(0, Number(parsed.total) || 0),
        successful: Math.max(0, Number(parsed.successful) || 0),
      };
    } catch {
      return { total: 0, successful: 0 };
    }
  }

  async applyQueryAccuracyDelta(totalDelta: number, successfulDelta: number): Promise<void> {
    const current = await this.getQueryAccuracy();
    const next: QueryAccuracyStats = {
      total: Math.max(0, current.total + totalDelta),
      // Never exceed total and never drop below zero.
      successful: Math.min(
        Math.max(0, current.total + totalDelta),
        Math.max(0, current.successful + successfulDelta)
      ),
    };
    localStorage.setItem(STORAGE_KEYS.QUERY_ACCURACY, JSON.stringify(next));
  }

  // Corrections are device-local here; the util layer owns the ring-buffer storage.
  async getCorrectionsForFingerprint(fingerprint: string): Promise<QueryCorrection[]> {
    return localGetCorrections(fingerprint);
  }

  async addQueryCorrection(entry: QueryCorrection): Promise<void> {
    localAddCorrection(entry);
  }

  async updateQueryCorrection(id: string, patch: Partial<QueryCorrection>): Promise<void> {
    localUpdateCorrection(id, patch);
  }

  async deleteQueryCorrection(id: string): Promise<void> {
    localDeleteCorrection(id);
  }

  async getDismissedNotifications(): Promise<string[]> {
    return JSON.parse(localStorage.getItem('dismissed_notifications') || '[]');
  }

  async dismissNotification(id: string): Promise<void> {
    const dismissed: string[] = JSON.parse(
      localStorage.getItem('dismissed_notifications') || '[]'
    );
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      localStorage.setItem('dismissed_notifications', JSON.stringify(dismissed));
    }
  }
}
