import type { DatabaseConnection } from './database-connection.interface';
import type { Schema } from './schema.interface';
import type { SavedReport } from './saved-report.interface';
import type { QueryHistoryEntry } from './query-history.interface';
import type { QueryAccuracyStats } from './query-accuracy.interface';

export interface DatabaseContextType {
    importConnections: (connections: DatabaseConnection[]) => void;
    getConnection: (id?: string | undefined) => DatabaseConnection | undefined;
    addConnection: (connection: DatabaseConnection) => void;
    updateConnection: (connection: DatabaseConnection) => void;
    deleteConnection: (id: string) => void;
    duplicateConnection: (id: string) => DatabaseConnection | null;

    getSchema: (id?: string | undefined) => Schema | undefined;
    setSchema: (schema: Schema) => void;

    setConnectionStatus: (status: "idle" | "success" | "error") => void;
    connectionStatus: "idle" | "success" | "error";

    connections: DatabaseConnection[];
    connectionSchemas: Schema[];

    setCurrentConnection: (connection: DatabaseConnection) => void;
    currentConnection: DatabaseConnection | undefined;

    setCurrentSchema: (schema: Schema) => void;
    currentSchema: Schema | undefined;

    isInitialized: boolean;
    refreshConnections: () => Promise<void>;

    // Reports
    reports: SavedReport[];
    loadReports: () => Promise<void>;
    saveReport: (report: SavedReport) => Promise<void>;
    updateReport: (report: SavedReport) => Promise<void>;
    deleteReport: (id: string) => Promise<void>;

    // Query history (device-local)
    recordQueryHistory: (entry: QueryHistoryEntry) => void;
    getQueryHistory: () => Promise<QueryHistoryEntry[]>;
    deleteQueryHistory: (id: string) => Promise<void>;
    clearQueryHistory: () => Promise<void>;

    // Query accuracy (global per-user; local by default, synced when auth enabled)
    queryAccuracy: QueryAccuracyStats;
    recordQueryOutcome: (success: boolean) => void;
    overrideQueryOutcome: (oldSuccess: boolean, newSuccess: boolean) => void;
}
