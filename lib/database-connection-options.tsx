"use client"
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { getStorageService } from '@/lib/services/storage';
import type { DatabaseConnection } from '@/models/database-connection.interface';
import type { Schema } from '@/models/schema.interface';

interface DatabaseContextType {
    importConnections: (connections: DatabaseConnection[]) => void;
    getConnection: (id?: string | undefined) => DatabaseConnection | undefined;
    addConnection: (connection: DatabaseConnection) => void;
    updateConnection: (connection: DatabaseConnection) => void;
    deleteConnection: (id: string) => void;

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
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function DatabaseConnectionOptions({ children }: { children: ReactNode }) {
    const [connections, setConnections] = useState<DatabaseConnection[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");
    const [connectionSchemas, setConnectionSchemas] = useState<Schema[]>([]);
    const [currentConnection, setCurrentConnectionState] = useState<DatabaseConnection>();
    const [currentSchema, setCurrentSchema] = useState<Schema>();
    const [isInitialized, setIsInitialized] = useState(false);

    // Load initial state from storage service
    useEffect(() => {
        const loadInitialState = async () => {
            try {
                const storage = getStorageService();

                // Load connections
                const storedConnections = await storage.connections.getConnections();
                setConnections(storedConnections);

                // Load schemas
                const storedSchemas = await storage.schemas.getAllSchemas();
                setConnectionSchemas(storedSchemas);

                // Load current connection
                if (storedConnections.length > 0) {
                    const defaultConnection = await storage.connections.getCurrentConnection();
                    if (defaultConnection) {
                        setCurrentConnectionState(defaultConnection);

                        const schema = storedSchemas.find((s) => s.connectionId === defaultConnection.id);
                        if (schema) {
                            setCurrentSchema(schema);
                        }
                    }
                }
            } catch (error) {
                console.error("Error loading initial state from storage:", error);
                // Reset to empty state if there's an error
                setConnections([]);
                setCurrentConnectionState(undefined);
                setCurrentSchema(undefined);
            } finally {
                setIsInitialized(true);
            }
        };

        loadInitialState();
    }, []);

    // Set current connection and persist to storage
    const setCurrentConnection = useCallback(async (connection: DatabaseConnection) => {
        const storage = getStorageService();

        // Update local state
        setCurrentConnectionState(connection);

        // Persist to storage
        await storage.connections.setCurrentConnection(connection);

        // Update connection status in connections array
        let updatedConnections: DatabaseConnection[];
        const existingConnection = connections.find(c => c.id === connection.id);

        if (existingConnection) {
            updatedConnections = connections.map((conn) =>
                conn.id === connection.id
                    ? { ...conn, status: "connected" as const }
                    : { ...conn, status: "disconnected" as const },
            );
        } else {
            updatedConnections = [...connections, connection];
        }

        setConnections(updatedConnections);

        // Persist connections update
        // Note: The localStorage adapter handles this through the individual operations

        // Update current schema
        const schema = connectionSchemas.find(s => s.connectionId === connection.id);
        setCurrentSchema(schema);
    }, [connections, connectionSchemas]);

    // Persist schemas when they change
    useEffect(() => {
        if (!isInitialized) return;

        const persistSchemas = async () => {
            const storage = getStorageService();
            // The schemas are persisted individually when setSchema is called
            // This effect ensures any bulk changes are also persisted
            for (const schema of connectionSchemas) {
                await storage.schemas.setSchema(schema);
            }
        };

        persistSchemas().catch(console.error);
    }, [connectionSchemas, isInitialized]);

    const getConnection = useCallback((id?: string): DatabaseConnection | undefined => {
        return id
            ? connections.find(c => c.id === id)
            : currentConnection;
    }, [connections, currentConnection]);

    const deleteConnection = useCallback(async (id: string) => {
        const storage = getStorageService();

        // Update local state
        const updatedConnections = connections.filter((conn) => conn.id !== id);
        setConnections(updatedConnections);

        // Clear current connection if deleted
        if (currentConnection?.id === id) {
            setCurrentConnectionState(undefined);
            setCurrentSchema(undefined);
        }

        // Persist to storage
        await storage.connections.deleteConnection(id);

        // Also delete the schema for this connection
        await storage.schemas.deleteSchema(id);
    }, [connections, currentConnection]);

    const updateConnection = useCallback(async (connection: DatabaseConnection) => {
        const storage = getStorageService();

        // Update local state
        const updatedConnections = connections.map((conn) =>
            conn.id === connection.id
                ? { ...conn, ...connection }
                : conn
        );
        setConnections(updatedConnections);

        // Update current connection if it's the same one
        if (currentConnection && connection.id === currentConnection.id) {
            setCurrentConnectionState(connection);
            await storage.connections.setCurrentConnection(connection);
        }

        // Persist to storage
        await storage.connections.updateConnection(connection.id, connection);
    }, [connections, currentConnection]);

    const addConnection = useCallback(async (connection: DatabaseConnection) => {
        const storage = getStorageService();

        // Update local state
        const updatedConnections = [...connections, connection];
        setConnections(updatedConnections);

        // Persist to storage
        // If the connection already has an ID, just save it; otherwise create it
        if (connection.id) {
            await storage.connections.updateConnection(connection.id, connection);
        } else {
            await storage.connections.createConnection(connection);
        }
    }, [connections]);

    const importConnections = useCallback(async (importedConnections: DatabaseConnection[]) => {
        const storage = getStorageService();

        // Update local state
        const updatedConnections = [...connections, ...importedConnections];
        setConnections(updatedConnections);

        // Persist to storage
        await storage.connections.importConnections(importedConnections);
    }, [connections]);

    const getSchema = useCallback((id?: string): Schema | undefined => {
        if (id) {
            return connectionSchemas.find(s => s.connectionId === id);
        }
        if (currentConnection) {
            return currentSchema;
        }
        return undefined;
    }, [connectionSchemas, currentConnection, currentSchema]);

    const setSchema = useCallback(async (schema: Schema): Promise<void> => {
        if (!schema) {
            throw new Error("No schema supplied!");
        }

        const storage = getStorageService();

        // Update local state
        const existingIndex = connectionSchemas.findIndex(s => s.connectionId === schema.connectionId);
        let updatedSchemas: Schema[];

        if (existingIndex >= 0) {
            updatedSchemas = connectionSchemas.map((s, i) =>
                i === existingIndex ? schema : s
            );
        } else {
            updatedSchemas = [...connectionSchemas, schema];
        }

        setConnectionSchemas(updatedSchemas);

        // Update current schema if it belongs to the current connection
        if (schema.connectionId === currentConnection?.id) {
            setCurrentSchema(schema);
        }

        // Persist to storage
        await storage.schemas.setSchema(schema);
    }, [connectionSchemas, currentConnection]);

    return (
        <DatabaseContext.Provider value={{
            setConnectionStatus,
            deleteConnection,
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
