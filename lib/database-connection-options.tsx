"use client"
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

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
                const storedConnections: DatabaseConnection[] = JSON.parse(localStorage.getItem("databaseConnections") || "[]");
                setConnections(storedConnections);
                const storedSchemas: Schema[] = JSON.parse(localStorage.getItem("connectionSchemas") || "[]");
                setConnectionSchemas(storedSchemas);

                if (storedConnections.length > 0) {
                    const defaultConnection: DatabaseConnection | undefined = JSON.parse(localStorage.getItem("currentDbConnection") || "null");
                    if (!!defaultConnection) {
                        setCurrentConnection(defaultConnection);

                        const schema = storedSchemas.find((schema) => schema.connectionId === defaultConnection.id);
                        if (!!schema) {
                            setCurrentSchema(schema);
                        }
                    }
                }
            } catch (error) {
                console.error("Error loading initial state from localStorage:", error);
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
            localStorage.setItem("currentDbConnection", JSON.stringify(currentConnection));
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
            localStorage.setItem("databaseConnections", JSON.stringify(updatedConnections));
            
            const schema = getSchema(currentConnection.id);
            if (!!schema) {
                setCurrentSchema(schema);
            }
        }
    }, [currentConnection]);

    useEffect(() => {
        localStorage.setItem("connectionSchemas", JSON.stringify(connectionSchemas));
    }, [connectionSchemas]);
    
    const getConnection = (id?: string): DatabaseConnection | undefined => {
        return !!id
            ? connections.find(f => f.id === id)
            : currentConnection;
    }
    
    const deleteConnection = (id: string) => {
        const updatedConnections = connections.filter((conn) => conn.id !== id)
        setConnections(updatedConnections)
        localStorage.setItem("databaseConnections", JSON.stringify(updatedConnections))
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
        localStorage.setItem("databaseConnections", JSON.stringify(updatedConnections));
    }
    
    const addConnection = (connection: DatabaseConnection) => {
        const updatedConnections = [...connections, connection]; 
        setConnections(updatedConnections);
        localStorage.setItem("databaseConnections", JSON.stringify(updatedConnections))
    }

    const importConnections = (connections: DatabaseConnection[]) => {
        const updatedConnections = [...connections, ...connections];
        setConnections(updatedConnections);
        localStorage.setItem("databaseConnections", JSON.stringify(updatedConnections))
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

        // Update current schema if it matches
        if (schema.connectionId === currentSchema?.connectionId) {
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
