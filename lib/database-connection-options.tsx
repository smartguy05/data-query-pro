"use client"
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import type { StorageProvider } from '@/lib/storage/storage-provider';
import type { SavedReport } from '@/models/saved-report.interface';
import { LocalStorageProvider } from '@/lib/storage/local-storage-provider';
import { ApiStorageProvider } from '@/lib/storage/api-storage-provider';

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function DatabaseConnectionOptions({ children }: { children: ReactNode }) {
    const [connections, setConnections] = useState<DatabaseConnection[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");
    const [connectionSchemas, setConnectionSchemas] = useState<Schema[]>([]);
    const [currentConnection, setCurrentConnection] = useState<DatabaseConnection>();
    const [currentSchema, setCurrentSchema] = useState<Schema>();
    const [isInitialized, setIsInitialized] = useState(false);
    const [allReports, setAllReports] = useState<SavedReport[]>([]);
    const storageRef = useRef<StorageProvider | null>(null);

    useEffect(() => {
        const loadInitialState = async () => {
            try {
                // Determine storage mode
                let authEnabled = false;
                try {
                    const authRes = await fetch('/api/config/auth-status');
                    if (authRes.ok) {
                        const authData = await authRes.json();
                        authEnabled = authData.authEnabled === true;
                    }
                } catch {
                    // Auth status endpoint not available, use localStorage
                }

                // When auth is enabled, check if user has a session before calling API
                if (authEnabled) {
                    try {
                        const sessionRes = await fetch('/api/auth/session');
                        const session = sessionRes.ok ? await sessionRes.json() : null;
                        if (!session?.user) {
                            // Not logged in — skip API calls, initialize empty
                            storageRef.current = null;
                            return;
                        }
                    } catch {
                        // Can't check session, initialize empty
                        storageRef.current = null;
                        return;
                    }
                }

                const storage: StorageProvider = authEnabled
                    ? new ApiStorageProvider()
                    : new LocalStorageProvider();
                storageRef.current = storage;

                // Load all data through the storage provider
                const allConnections = await storage.getConnections();
                setConnections(allConnections);

                const allSchemas = await storage.getSchemas();
                setConnectionSchemas(allSchemas);

                // Load reports
                try {
                    const loadedReports = await storage.getReports();
                    setAllReports(loadedReports);
                } catch {
                    // Reports may not be available
                }

                if (allConnections.length > 0) {
                    const currentId = await storage.getCurrentConnectionId();
                    let foundConnection = currentId
                        ? allConnections.find(conn => conn.id === currentId)
                        : undefined;

                    // Auto-select first connection if no valid current connection
                    if (!foundConnection) {
                        foundConnection = allConnections[0];
                    }

                    if (foundConnection) {
                        setCurrentConnection(foundConnection);
                        const schema = allSchemas.find(s => s.connectionId === foundConnection!.id);
                        if (schema) {
                            setCurrentSchema(schema);
                        }
                    }
                }
            } catch (error) {
                console.error("Error loading initial state:", error);
                setConnections([]);
                setCurrentConnection(undefined);
                setCurrentSchema(undefined);
            } finally {
                setIsInitialized(true);
            }
        };

        loadInitialState();
    }, []);

    useEffect(() => {
        if (currentConnection && storageRef.current) {
            storageRef.current.setCurrentConnectionId(currentConnection.id);

            let updatedConnections: DatabaseConnection[];
            if (connections.find(f => f.id === currentConnection.id)) {
                updatedConnections = connections.map((conn) =>
                    conn.id === currentConnection.id
                        ? { ...conn, status: "connected" as const }
                        : { ...conn, status: "disconnected" as const },
                );
            } else {
                updatedConnections = [...connections, currentConnection];
            }
            setConnections(updatedConnections);

            // For localStorage mode, persist local connections
            if (storageRef.current instanceof LocalStorageProvider) {
                const localConnectionsOnly = updatedConnections.filter(conn => conn.source !== "server");
                localStorage.setItem("databaseConnections", JSON.stringify(localConnectionsOnly));
            }

            const schema = connectionSchemas.find(s => s.connectionId === currentConnection.id);
            setCurrentSchema(schema);
        }
    }, [currentConnection, connectionSchemas]);

    useEffect(() => {
        if (isInitialized && storageRef.current instanceof LocalStorageProvider) {
            localStorage.setItem("connectionSchemas", JSON.stringify(connectionSchemas));
        }
    }, [connectionSchemas, isInitialized]);

    const getConnection = (id?: string): DatabaseConnection | undefined => {
        return !!id
            ? connections.find(f => f.id === id)
            : currentConnection;
    }

    const deleteConnection = (id: string) => {
        const updatedConnections = connections.filter((conn) => conn.id !== id);
        setConnections(updatedConnections);

        if (storageRef.current instanceof LocalStorageProvider) {
            const localConnectionsOnly = updatedConnections.filter(conn => conn.source !== "server");
            localStorage.setItem("databaseConnections", JSON.stringify(localConnectionsOnly));
        } else if (storageRef.current) {
            storageRef.current.deleteConnection(id);
        }
    }

    const updateConnection = (connection: DatabaseConnection) => {
        const updatedConnections = connections.map((conn) =>
            conn.id === connection.id
                ? { ...conn, ...connection }
                : conn
        );
        setConnections(updatedConnections);
        if (!!currentConnection && connection.id === currentConnection.id) {
            setCurrentConnection(connection);
        }

        if (storageRef.current instanceof LocalStorageProvider) {
            const localConnectionsOnly = updatedConnections.filter(conn => conn.source !== "server");
            localStorage.setItem("databaseConnections", JSON.stringify(localConnectionsOnly));
        } else if (storageRef.current) {
            storageRef.current.updateConnection(connection);
        }
    }

    const addConnection = (connection: DatabaseConnection) => {
        const updatedConnections = [...connections, connection];
        setConnections(updatedConnections);

        if (storageRef.current instanceof LocalStorageProvider) {
            const localConnectionsOnly = updatedConnections.filter(conn => conn.source !== "server");
            localStorage.setItem("databaseConnections", JSON.stringify(localConnectionsOnly));
        } else if (storageRef.current) {
            storageRef.current.addConnection(connection);
        }
    }

    const importConnections = (importedConnections: DatabaseConnection[]) => {
        const updatedConnections = [...connections, ...importedConnections];
        setConnections(updatedConnections);

        if (storageRef.current instanceof LocalStorageProvider) {
            const localConnectionsOnly = updatedConnections.filter(conn => conn.source !== "server");
            localStorage.setItem("databaseConnections", JSON.stringify(localConnectionsOnly));
        } else if (storageRef.current) {
            storageRef.current.importConnections(importedConnections);
        }
    }

    const duplicateConnection = (id: string): DatabaseConnection | null => {
        const originalConnection = connections.find(c => c.id === id);
        if (!originalConnection) {
            return null;
        }

        const newId = Date.now().toString();
        const isServerConnection = originalConnection.source === "server";
        const newConnection: DatabaseConnection = {
            ...originalConnection,
            id: newId,
            name: `${originalConnection.name} (Copy)`,
            schemaFileId: undefined,
            vectorStoreId: undefined,
            status: "disconnected",
            source: "local",
            createdAt: new Date().toISOString(),
            ...(isServerConnection && {
                host: "",
                port: originalConnection.type === "postgresql" ? "5432"
                    : originalConnection.type === "mysql" ? "3306"
                    : originalConnection.type === "sqlserver" ? "1433"
                    : "",
                database: "",
                username: "",
                password: "",
            }),
        };

        const originalSchema = connectionSchemas.find(s => s.connectionId === id);
        if (originalSchema) {
            const newSchema: Schema = {
                ...originalSchema,
                connectionId: newId,
                tables: originalSchema.tables.map(table => ({
                    ...table,
                    columns: table.columns.map(col => ({ ...col })),
                })),
            };
            setConnectionSchemas(prev => [...prev, newSchema]);

            if (storageRef.current && !(storageRef.current instanceof LocalStorageProvider)) {
                storageRef.current.setSchema(newSchema);
            }
        }

        const savedReports: SavedReport[] = JSON.parse(localStorage.getItem("saved_reports") || "[]");
        const originalReports = savedReports.filter(r => r.connectionId === id);
        if (originalReports.length > 0) {
            const now = new Date().toISOString();
            const newReports = originalReports.map(report => ({
                ...report,
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                connectionId: newId,
                createdAt: now,
                lastModified: now,
                lastRun: undefined,
            }));
            localStorage.setItem("saved_reports", JSON.stringify([...savedReports, ...newReports]));
        }

        const suggestionsKey = `suggestions_${id}`;
        const suggestions = localStorage.getItem(suggestionsKey);
        if (suggestions) {
            localStorage.setItem(`suggestions_${newId}`, suggestions);
        }

        addConnection(newConnection);
        return newConnection;
    }

    const getSchema = (id?: string): Schema | undefined => {
        if (!!id) {
            return connectionSchemas.find(f => f.connectionId === id);
        }
        if (!!currentConnection) {
            return currentSchema;
        }
        return undefined;
    }

    const setSchema = (schema: Schema): void => {
        if (!schema) {
            throw new Error("No schema supplied!");
        }

        const connectionSchema = connectionSchemas.find(f => f.connectionId === schema.connectionId);
        if (!!connectionSchema) {
            const updatedSchemas = connectionSchemas.map((s) => {
                if (s.connectionId === schema.connectionId) {
                    return schema;
                }
                return s;
            });
            setConnectionSchemas(updatedSchemas);
        } else {
            setConnectionSchemas([...connectionSchemas, schema]);
        }

        if (schema.connectionId === currentConnection?.id) {
            setCurrentSchema(schema);
        }

        // Persist to API storage if in auth mode
        if (storageRef.current && !(storageRef.current instanceof LocalStorageProvider)) {
            storageRef.current.setSchema(schema);
        }
    }

    const refreshConnections = useCallback(async () => {
        if (!storageRef.current) return;
        try {
            const allConnections = await storageRef.current.getConnections();
            setConnections(allConnections);

            const allSchemas = await storageRef.current.getSchemas();
            setConnectionSchemas(allSchemas);

            // Update current connection/schema if still valid
            if (currentConnection) {
                const stillExists = allConnections.find(c => c.id === currentConnection.id);
                if (stillExists) {
                    setCurrentConnection(stillExists);
                    const schema = allSchemas.find(s => s.connectionId === stillExists.id);
                    setCurrentSchema(schema);
                } else if (allConnections.length > 0) {
                    // Current connection was removed, switch to first available
                    setCurrentConnection(allConnections[0]);
                    const schema = allSchemas.find(s => s.connectionId === allConnections[0].id);
                    setCurrentSchema(schema);
                } else {
                    setCurrentConnection(undefined);
                    setCurrentSchema(undefined);
                }
            }
        } catch (error) {
            console.error("Error refreshing connections:", error);
        }
    }, [currentConnection]);

    // --- Report methods ---
    const loadReports = useCallback(async () => {
        if (!storageRef.current) {
            // Fallback to localStorage when no storage provider
            const stored = JSON.parse(localStorage.getItem("saved_reports") || "[]") as SavedReport[];
            setAllReports(stored);
            return;
        }
        try {
            const loaded = await storageRef.current.getReports();
            setAllReports(loaded);
        } catch {
            setAllReports([]);
        }
    }, []);

    const saveReportCtx = useCallback(async (report: SavedReport) => {
        if (storageRef.current) {
            await storageRef.current.saveReport(report);
        } else {
            const stored = JSON.parse(localStorage.getItem("saved_reports") || "[]") as SavedReport[];
            stored.push(report);
            localStorage.setItem("saved_reports", JSON.stringify(stored));
        }
        setAllReports(prev => [...prev, report]);
    }, []);

    const updateReportCtx = useCallback(async (report: SavedReport) => {
        if (storageRef.current) {
            await storageRef.current.updateReport(report);
        } else {
            const stored = JSON.parse(localStorage.getItem("saved_reports") || "[]") as SavedReport[];
            const updated = stored.map(r => r.id === report.id ? report : r);
            localStorage.setItem("saved_reports", JSON.stringify(updated));
        }
        setAllReports(prev => prev.map(r => r.id === report.id ? report : r));
    }, []);

    const deleteReportCtx = useCallback(async (id: string) => {
        if (storageRef.current) {
            await storageRef.current.deleteReport(id);
        } else {
            const stored = JSON.parse(localStorage.getItem("saved_reports") || "[]") as SavedReport[];
            localStorage.setItem("saved_reports", JSON.stringify(stored.filter(r => r.id !== id)));
        }
        setAllReports(prev => prev.filter(r => r.id !== id));
    }, []);

    return (
        <DatabaseContext.Provider value={{
            setConnectionStatus,
            deleteConnection,
            duplicateConnection,
            setCurrentConnection,
            importConnections,
            updateConnection,
            getConnection,
            addConnection,
            getSchema,
            setSchema,
            connections,
            connectionStatus,
            currentSchema,
            setCurrentSchema,
            currentConnection,
            connectionSchemas,
            isInitialized,
            refreshConnections,
            reports: allReports,
            loadReports,
            saveReport: saveReportCtx,
            updateReport: updateReportCtx,
            deleteReport: deleteReportCtx,
    }}>
    {children}
    </DatabaseContext.Provider>
);
}

export function useDatabaseOptions() {
    const context = useContext(DatabaseContext);
    if (context === undefined) {
        throw new Error('useDatabaseContext must be used within a DatabaseProvider');
    }
    return context;
}
