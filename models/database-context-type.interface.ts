import type { DatabaseConnection } from './database-connection.interface';
import type { Schema } from './schema.interface';
import type { SavedReport } from './saved-report.interface';
import type { QueryHistoryEntry } from './query-history.interface';
import type { QueryAccuracyStats } from './query-accuracy.interface';
import type { QueryCorrection } from './query-correction.interface';

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

    // Namespace ("schema") switching for the current connection (PostgreSQL/SQL
    // Server). activeSchema is the resolved selected namespace; availableSchemas
    // is populated by loadAvailableSchemas() (empty for DBs without namespaces).
    activeSchema: string | undefined;
    availableSchemas: string[];
    schemaListLoading: boolean;
    loadAvailableSchemas: () => Promise<void>;
    switchSchema: (schemaName: string) => void;

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

    // Learned query corrections (failed->revised pairs). Device-local by default;
    // pooled team-wide by schema fingerprint when auth is enabled. Recording is
    // fire-and-forget so it can never break the query-execution flow.
    recordQueryCorrection: (entry: QueryCorrection) => void;
    getCorrectionsForFingerprint: (fingerprint: string) => Promise<QueryCorrection[]>;
    updateQueryCorrection: (id: string, patch: Partial<QueryCorrection>) => Promise<void>;
    deleteQueryCorrection: (id: string) => Promise<void>;
}
