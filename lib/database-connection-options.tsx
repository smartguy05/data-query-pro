"use client"
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import type { StorageProvider } from '@/lib/storage/storage-provider';
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

                const storage: StorageProvider = authEnabled
                    ? new ApiStorageProvider()
                    : new LocalStorageProvider();
                storageRef.current = storage;

                // Load all data through the storage provider
                const allConnections = await storage.getConnections();
                setConnections(allConnections);

                const allSchemas = await storage.getSchemas();
                setConnectionSchemas(allSchemas);

                if (allConnections.length > 0) {
                    const currentId = await storage.getCurrentConnectionId();
                    if (currentId) {
                        const foundConnection = allConnections.find(conn => conn.id === currentId);
                        if (foundConnection) {
                            setCurrentConnection(foundConnection);
                            const schema = allSchemas.find(s => s.connectionId === foundConnection.id);
                            if (schema) {
                                setCurrentSchema(schema);
                            }
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
