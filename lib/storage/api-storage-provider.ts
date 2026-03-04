import type { StorageProvider } from './storage-provider';
import type { SavedReport } from '@/models/saved-report.interface';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error.error?.message || `API error: ${res.status}`);
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export class ApiStorageProvider implements StorageProvider {
  async getConnections(): Promise<DatabaseConnection[]> {
    return apiFetch<DatabaseConnection[]>('/api/data/connections');
  }

  async addConnection(conn: DatabaseConnection): Promise<void> {
    await apiFetch('/api/data/connections', {
      method: 'POST',
      body: JSON.stringify(conn),
    });
  }

  async updateConnection(conn: DatabaseConnection): Promise<void> {
    await apiFetch(`/api/data/connections/${conn.id}`, {
      method: 'PUT',
      body: JSON.stringify(conn),
    });
  }

  async deleteConnection(id: string): Promise<void> {
    await apiFetch(`/api/data/connections/${id}`, {
      method: 'DELETE',
    });
  }

  async duplicateConnection(id: string): Promise<DatabaseConnection | null> {
    return apiFetch<DatabaseConnection | null>(`/api/data/connections/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'duplicate' }),
    });
  }

  async importConnections(conns: DatabaseConnection[]): Promise<void> {
    await apiFetch('/api/data/import-local', {
      method: 'POST',
      body: JSON.stringify({ connections: conns }),
    });
  }

  async getCurrentConnectionId(): Promise<string | null> {
    const prefs = await apiFetch<{ currentConnectionId: string | null }>('/api/data/preferences');
    return prefs.currentConnectionId;
  }

  async setCurrentConnectionId(id: string | null): Promise<void> {
    await apiFetch('/api/data/preferences', {
      method: 'PUT',
      body: JSON.stringify({ currentConnectionId: id }),
    });
  }

  async getSchemas(): Promise<Schema[]> {
    // Schemas are fetched per-connection, but we need all for initial load
    // The connections list will tell us which ones have schemas
    const connections = await this.getConnections();
    const schemas: Schema[] = [];

    for (const conn of connections) {
      try {
        const schema = await apiFetch<Schema | null>(`/api/data/schemas/${conn.id}`);
        if (schema) {
          schemas.push(schema);
        }
      } catch {
        // Schema may not exist for this connection
      }
    }

    return schemas;
  }

  async setSchema(schema: Schema): Promise<void> {
    await apiFetch(`/api/data/schemas/${schema.connectionId}`, {
      method: 'PUT',
      body: JSON.stringify(schema),
    });
  }

  async getReports(): Promise<SavedReport[]> {
    return apiFetch<SavedReport[]>('/api/data/reports');
  }

  async saveReport(report: SavedReport): Promise<void> {
    await apiFetch('/api/data/reports', {
      method: 'POST',
      body: JSON.stringify(report),
    });
  }

  async updateReport(report: SavedReport): Promise<void> {
    await apiFetch(`/api/data/reports/${report.id}`, {
      method: 'PUT',
      body: JSON.stringify(report),
    });
  }

  async deleteReport(id: string): Promise<void> {
    await apiFetch(`/api/data/reports/${id}`, {
      method: 'DELETE',
    });
  }

  async getSuggestions(connectionId: string): Promise<unknown[] | null> {
    try {
      return await apiFetch<unknown[]>(`/api/data/suggestions/${connectionId}`);
    } catch {
      return null;
    }
  }

  async setSuggestions(connectionId: string, suggestions: unknown[]): Promise<void> {
    await apiFetch(`/api/data/suggestions/${connectionId}`, {
      method: 'PUT',
      body: JSON.stringify({ suggestions }),
    });
  }

  async getDismissedNotifications(): Promise<string[]> {
    try {
      const prefs = await apiFetch<{ currentConnectionId: string | null; preferences: Record<string, unknown> }>('/api/data/preferences');
      return (prefs.preferences?.dismissedNotifications as string[]) || [];
    } catch {
      return [];
    }
  }

  async dismissNotification(id: string): Promise<void> {
    await apiFetch('/api/data/notifications/dismiss', {
      method: 'POST',
      body: JSON.stringify({ notificationId: id }),
    });
  }
}
