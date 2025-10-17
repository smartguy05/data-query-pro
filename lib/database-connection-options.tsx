"use client"
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { storage, StorageKeys } from '@/lib/storage';

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function DatabaseConnectionOptions({ children }: { children: ReactNode }) {
    const [connections, setConnections] = useState<DatabaseConnection[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");
    const [connectionSchemas, setConnectionSchemas] = useState<Schema[]>([]);
    const [currentConnection, setCurrentConnection] = useState<DatabaseConnection>();
    const [currentSchema, setCurrentSchema] = useState<Schema>();
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const loadInitialState = () => {
            try {
                const storedConnections = storage.get<DatabaseConnection[]>(StorageKeys.DATABASE_CONNECTIONS, []);
                setConnections(storedConnections);

                const storedSchemas = storage.get<Schema[]>(StorageKeys.CONNECTION_SCHEMAS, []);
                setConnectionSchemas(storedSchemas);

                if (storedConnections.length > 0) {
                    const defaultConnection = storage.getOptional<DatabaseConnection>(StorageKeys.CURRENT_DB_CONNECTION);
                    if (!!defaultConnection) {
                        setCurrentConnection(defaultConnection);

                        const schema = storedSchemas.find((schema) => schema.connectionId === defaultConnection.id);
                        if (!!schema) {
                            setCurrentSchema(schema);
                        }
                    }
                }
            } catch (error) {
                console.error("Error loading initial state from storage:", error);
                // Reset to empty state if there's an error parsing
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
        if (currentConnection) {
            storage.set(StorageKeys.CURRENT_DB_CONNECTION, currentConnection);
            let updatedConnections: DatabaseConnection[] = [];

            // Update connection status in saved connections
            if (connections.find(f => f.id == currentConnection.id)) {
                updatedConnections = connections.map((conn) =>
                    conn.id === currentConnection.id
                        ? { ...conn, status: "connected" as const }
                        : { ...conn, status: "disconnected" as const },
                );
            } else {
                updatedConnections = [...connections, currentConnection];
            }
            setConnections(updatedConnections);
            storage.set(StorageKeys.DATABASE_CONNECTIONS, updatedConnections);

            // Always update currentSchema when connection changes
            const schema = getSchema(currentConnection.id);
            setCurrentSchema(schema);
        }
    }, [currentConnection]);

    useEffect(() => {
        storage.set(StorageKeys.CONNECTION_SCHEMAS, connectionSchemas);
    }, [connectionSchemas]);
    
    const getConnection = (id?: string): DatabaseConnection | undefined => {
        return !!id
            ? connections.find(f => f.id === id)
            : currentConnection;
    }
    
    const deleteConnection = (id: string) => {
        setConnections(prevConnections => {
            const updatedConnections = prevConnections.filter((conn) => conn.id !== id);
            storage.set(StorageKeys.DATABASE_CONNECTIONS, updatedConnections);
            return updatedConnections;
        });
    }

    const updateConnection = (connection: DatabaseConnection) => {
        // Use functional update to avoid stale closure
        setConnections(prevConnections => {
            const updatedConnections = prevConnections.map((conn) =>
                conn.id === connection.id
                    ? { ...conn, ...connection }
                    : conn
            );
            storage.set(StorageKeys.DATABASE_CONNECTIONS, updatedConnections);
            return updatedConnections;
        });

        if (!!currentConnection && connection.id === currentConnection.id) {
            setCurrentConnection(connection);
        }
    }
    
    const addConnection = (connection: DatabaseConnection) => {
        setConnections(prevConnections => {
            const updatedConnections = [...prevConnections, connection];
            storage.set(StorageKeys.DATABASE_CONNECTIONS, updatedConnections);
            return updatedConnections;
        });
    }

    const importConnections = (importedConnections: DatabaseConnection[]) => {
        setConnections(prevConnections => {
            const updatedConnections = [...prevConnections, ...importedConnections];
            storage.set(StorageKeys.DATABASE_CONNECTIONS, updatedConnections);
            return updatedConnections;
        });
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

        // Use functional state update to avoid stale closure issues
        // This ensures we always work with the latest state, even when
        // multiple setSchema calls happen in rapid succession (e.g., during import)
        setConnectionSchemas(prevSchemas => {
            const existingIndex = prevSchemas.findIndex(s => s.connectionId === schema.connectionId);

            if (existingIndex !== -1) {
                // Update existing schema
                const updatedSchemas = [...prevSchemas];
                updatedSchemas[existingIndex] = schema;
                return updatedSchemas;
            } else {
                // Add new schema
                return [...prevSchemas, schema];
            }
        });

        // Update current schema if it belongs to the current connection
        if (schema.connectionId === currentConnection?.id) {
            setCurrentSchema(schema);
        }
    }
    
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
