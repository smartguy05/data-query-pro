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
        const loadInitialState = async () => {
            try {
                // Load local connections from localStorage
                const storedConnections: DatabaseConnection[] = JSON.parse(localStorage.getItem("databaseConnections") || "[]");

                // Mark all local connections with source
                const localConnections = storedConnections.map(conn => ({
                    ...conn,
                    source: conn.source || "local" as const
                }));

                // Fetch server-side config (connections, schemas, reports)
                let serverConnections: DatabaseConnection[] = [];
                let serverSchemas: Schema[] = [];
                let serverCurrentConnection: DatabaseConnection | null = null;
                try {
                    const response = await fetch("/api/config/connections");
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.connections) {
                            serverConnections = data.connections;
                        }
                        // Load schemas from server config (schemaData is keyed by connection ID)
                        if (data.schemaData) {
                            serverSchemas = Object.values(data.schemaData) as Schema[];
                        }
                        // Load current connection preference from server config
                        if (data.currentConnection) {
                            serverCurrentConnection = data.currentConnection;
                        }
                        // Load saved reports from server config into localStorage if not already present
                        if (data.savedReports && Array.isArray(data.savedReports)) {
                            const existingReports = JSON.parse(localStorage.getItem("saved_reports") || "[]");
                            if (existingReports.length === 0) {
                                localStorage.setItem("saved_reports", JSON.stringify(data.savedReports));
                            }
                        }
                    }
                } catch (error) {
                    console.error("Failed to load server config:", error);
                    // Continue with just local data
                }

                // Merge server and local connections
                // Server connections come first, then local connections
                const allConnections = [...serverConnections, ...localConnections];
                setConnections(allConnections);

                // Merge server and local schemas
                // Server schemas take precedence (come first), local schemas fill in gaps
                const storedSchemas: Schema[] = JSON.parse(localStorage.getItem("connectionSchemas") || "[]");
                const serverSchemaIds = new Set(serverSchemas.map(s => s.connectionId));
                const localOnlySchemas = storedSchemas.filter(s => !serverSchemaIds.has(s.connectionId));
                const allSchemas = [...serverSchemas, ...localOnlySchemas];
                setConnectionSchemas(allSchemas);

                if (allConnections.length > 0) {
                    // Try localStorage first, then fall back to server config current connection
                    let defaultConnection: DatabaseConnection | undefined = JSON.parse(localStorage.getItem("currentDbConnection") || "null");
                    if (!defaultConnection && serverCurrentConnection) {
                        defaultConnection = serverCurrentConnection;
                    }
                    if (!!defaultConnection) {
                        // Find the connection in the merged list (in case it's a server connection)
                        const foundConnection = allConnections.find(conn => conn.id === defaultConnection!.id);
                        if (foundConnection) {
                            setCurrentConnection(foundConnection);

                            const schema = allSchemas.find((schema) => schema.connectionId === foundConnection.id);
                            if (!!schema) {
                                setCurrentSchema(schema);
                            }
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

            // Only save local connections to localStorage
            const localConnectionsOnly = updatedConnections.filter(conn => conn.source !== "server");
            localStorage.setItem("databaseConnections", JSON.stringify(localConnectionsOnly));

            // Always update currentSchema when connection or schemas change
            // Look up directly from connectionSchemas to ensure we get the latest
            const schema = connectionSchemas.find(s => s.connectionId === currentConnection.id);
            setCurrentSchema(schema);
        }
    }, [currentConnection, connectionSchemas]);

    // Only save schemas to localStorage after initialization is complete
    // This prevents overwriting saved data before it's loaded
    useEffect(() => {
        if (isInitialized) {
            localStorage.setItem("connectionSchemas", JSON.stringify(connectionSchemas));
        }
    }, [connectionSchemas, isInitialized]);
    
    const getConnection = (id?: string): DatabaseConnection | undefined => {
        return !!id
            ? connections.find(f => f.id === id)
            : currentConnection;
    }
    
    const deleteConnection = (id: string) => {
        const updatedConnections = connections.filter((conn) => conn.id !== id)
        setConnections(updatedConnections)
        // Only save local connections to localStorage
        const localConnectionsOnly = updatedConnections.filter(conn => conn.source !== "server");
        localStorage.setItem("databaseConnections", JSON.stringify(localConnectionsOnly))
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
        // Only save local connections to localStorage
        const localConnectionsOnly = updatedConnections.filter(conn => conn.source !== "server");
        localStorage.setItem("databaseConnections", JSON.stringify(localConnectionsOnly));
    }
    
    const addConnection = (connection: DatabaseConnection) => {
        const updatedConnections = [...connections, connection];
        setConnections(updatedConnections);
        // Only save local connections to localStorage
        const localConnectionsOnly = updatedConnections.filter(conn => conn.source !== "server");
        localStorage.setItem("databaseConnections", JSON.stringify(localConnectionsOnly))
    }

    const importConnections = (importedConnections: DatabaseConnection[]) => {
        const updatedConnections = [...connections, ...importedConnections];
        setConnections(updatedConnections);
        // Only save local connections to localStorage
        const localConnectionsOnly = updatedConnections.filter(conn => conn.source !== "server");
        localStorage.setItem("databaseConnections", JSON.stringify(localConnectionsOnly))
    }

    const duplicateConnection = (id: string): DatabaseConnection | null => {
        // Find the original connection
        const originalConnection = connections.find(c => c.id === id);
        if (!originalConnection) {
            return null;
        }

        // Generate new unique ID
        const newId = Date.now().toString();

        // Create new connection with cleared vector store IDs
        // For server connections, clear obscured credentials so user must re-enter them
        const isServerConnection = originalConnection.source === "server";
        const newConnection: DatabaseConnection = {
            ...originalConnection,
            id: newId,
            name: `${originalConnection.name} (Copy)`,
            schemaFileId: undefined,
            vectorStoreId: undefined,
            status: "disconnected",
            source: "local", // Always local, even if duplicating server connection
            createdAt: new Date().toISOString(),
            // Clear obscured credentials from server connections
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

        // Duplicate schema if exists
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
            // Add schema (will be saved via useEffect)
            setConnectionSchemas(prev => [...prev, newSchema]);
        }

        // Duplicate reports
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

        // Copy AI suggestions cache if exists
        const suggestionsKey = `suggestions_${id}`;
        const suggestions = localStorage.getItem(suggestionsKey);
        if (suggestions) {
            localStorage.setItem(`suggestions_${newId}`, suggestions);
        }

        // Add the new connection
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

        // Update current schema if it belongs to the current connection
        if (schema.connectionId === currentConnection?.id) {
            setCurrentSchema(schema);
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
