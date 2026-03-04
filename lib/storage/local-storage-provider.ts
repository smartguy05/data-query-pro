import type { StorageProvider } from './storage-provider';
import type { SavedReport } from '@/models/saved-report.interface';

export class LocalStorageProvider implements StorageProvider {
  private serverConnections: DatabaseConnection[] = [];
  private serverSchemas: Schema[] = [];
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
    return JSON.parse(localStorage.getItem('saved_reports') || '[]');
  }

  async saveReport(report: SavedReport): Promise<void> {
    const reports: SavedReport[] = JSON.parse(
      localStorage.getItem('saved_reports') || '[]'
    );
    reports.push(report);
    localStorage.setItem('saved_reports', JSON.stringify(reports));
  }

  async updateReport(report: SavedReport): Promise<void> {
    const reports: SavedReport[] = JSON.parse(
      localStorage.getItem('saved_reports') || '[]'
    );
    const updated = reports.map(r => (r.id === report.id ? report : r));
    localStorage.setItem('saved_reports', JSON.stringify(updated));
  }

  async deleteReport(id: string): Promise<void> {
    const reports: SavedReport[] = JSON.parse(
      localStorage.getItem('saved_reports') || '[]'
    );
    localStorage.setItem(
      'saved_reports',
      JSON.stringify(reports.filter(r => r.id !== id))
    );
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
