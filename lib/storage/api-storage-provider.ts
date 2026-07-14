import type { StorageProvider } from './storage-provider';
import type { DatabaseConnection } from '@/models/database-connection.interface';
import type { Schema } from '@/models/schema.interface';
import type { SavedReport } from '@/models/saved-report.interface';
import type { QueryHistoryEntry } from '@/models/query-history.interface';
import type { QueryAccuracyStats } from '@/models/query-accuracy.interface';
import type { QueryCorrection } from '@/models/query-correction.interface';
import { HISTORY, STORAGE_KEYS, isDefaultQueryLimit, type DefaultQueryLimit } from '@/lib/constants';

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

  // Query history is intentionally device-local (not synced to the app DB), so even in
  // auth mode it is stored in the browser's localStorage rather than via an API route.
  async getQueryHistory(): Promise<QueryHistoryEntry[]> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.QUERY_HISTORY) || '[]');
    } catch {
      return [];
    }
  }

  async addQueryHistory(entry: QueryHistoryEntry): Promise<void> {
    const existing = await this.getQueryHistory();
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

  async getQueryAccuracy(): Promise<QueryAccuracyStats> {
    try {
      return await apiFetch<QueryAccuracyStats>('/api/data/query-accuracy');
    } catch {
      return { total: 0, successful: 0 };
    }
  }

  async applyQueryAccuracyDelta(totalDelta: number, successfulDelta: number): Promise<void> {
    await apiFetch('/api/data/query-accuracy', {
      method: 'PUT',
      body: JSON.stringify({ totalDelta, successfulDelta }),
    });
  }

  // Corrections are pooled team-wide in Postgres, keyed by schema fingerprint.
  async getCorrectionsForFingerprint(fingerprint: string): Promise<QueryCorrection[]> {
    if (!fingerprint) return [];
    try {
      return await apiFetch<QueryCorrection[]>(
        `/api/data/corrections?fingerprint=${encodeURIComponent(fingerprint)}`
      );
    } catch {
      return [];
    }
  }

  async addQueryCorrection(entry: QueryCorrection): Promise<void> {
    await apiFetch('/api/data/corrections', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async updateQueryCorrection(id: string, patch: Partial<QueryCorrection>): Promise<void> {
    await apiFetch(`/api/data/corrections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  }

  async deleteQueryCorrection(id: string): Promise<void> {
    await apiFetch(`/api/data/corrections/${id}`, {
      method: 'DELETE',
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

  async getDefaultQueryLimit(): Promise<DefaultQueryLimit | null> {
    try {
      const prefs = await apiFetch<{ preferences: Record<string, unknown> }>('/api/data/preferences');
      const v = prefs.preferences?.defaultQueryLimit;
      return isDefaultQueryLimit(v) ? v : null;
    } catch {
      return null;
    }
  }

  async setDefaultQueryLimit(limit: DefaultQueryLimit): Promise<void> {
    // The preferences PUT replaces the whole JSONB (COALESCE in
    // preference-repository.ts), so read-merge-write to preserve sibling keys.
    const prefs = await apiFetch<{ preferences: Record<string, unknown> }>('/api/data/preferences');
    await apiFetch('/api/data/preferences', {
      method: 'PUT',
      body: JSON.stringify({
        preferences: { ...(prefs.preferences || {}), defaultQueryLimit: limit },
      }),
    });
  }
}
