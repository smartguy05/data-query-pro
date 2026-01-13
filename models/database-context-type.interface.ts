
interface DatabaseContextType {
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
}
