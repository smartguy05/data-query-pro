import sql from 'mssql';
import { BaseDatabaseAdapter } from '../base-adapter';
import type { AdapterConnectionConfig, DatabaseType, ParameterizedQuery } from '../types';
import { SQLServerQueries } from '../queries/sqlserver.queries';

export class SQLServerAdapter extends BaseDatabaseAdapter {
  readonly type: DatabaseType = 'sqlserver';
  readonly displayName = 'Microsoft SQL Server';
  readonly defaultPort = 1433;

  private pool: sql.ConnectionPool | null = null;

  async connect(config: AdapterConnectionConfig): Promise<void> {
    this.pool = await sql.connect({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: {
        encrypt: config.ssl !== false,
        trustServerCertificate: true,
      },
    });

    this.config = config;
    this.readOnly = !!config.readOnly;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
    this.connected = false;
    this.config = null;
  }

  async executeRawQuery(sqlQuery: string): Promise<Record<string, unknown>[]> {
    if (!this.pool) {
      throw new Error('Not connected to SQL Server');
    }
    if (this.readOnly) {
      // T-SQL has no true read-only transaction mode, so wrap the query in a
      // transaction and ALWAYS roll back — this discards any DML the AST validator
      // missed. NOTE: some DDL (CREATE/DROP/TRUNCATE) auto-commits and cannot be
      // rolled back in SQL Server; the AST validator is the primary defense there.
      const tx = new sql.Transaction(this.pool);
      await tx.begin();
      try {
        const result = await new sql.Request(tx).query(sqlQuery);
        return result.recordset as Record<string, unknown>[];
      } finally {
        await tx.rollback();
      }
    }
    const result = await this.pool.request().query(sqlQuery);
    return result.recordset as Record<string, unknown>[];
  }

  async executeParameterizedQuery(query: ParameterizedQuery): Promise<Record<string, unknown>[]> {
    if (!this.pool) {
      throw new Error('Not connected to SQL Server');
    }

    const request = this.pool.request();

    // Add parameters with named bindings
    // SQL Server uses @paramName style, we assume params array corresponds to @tableName
    query.params.forEach((param, index) => {
      // Extract parameter name from query (e.g., @tableName)
      const paramNames = query.sql.match(/@\w+/g) || [];
      const paramName = paramNames[index]?.substring(1) || `param${index}`;
      request.input(paramName, param);
    });

    const result = await request.query(query.sql);
    return result.recordset as Record<string, unknown>[];
  }

  /** Active namespace for this connection; defaults to SQL Server's "dbo". */
  private schemaName(): string {
    return this.config?.schema || 'dbo';
  }

  async listSchemas(): Promise<string[]> {
    if (!this.pool) {
      throw new Error('Not connected to SQL Server');
    }
    // Exclude SQL Server's built-in/system schemas, leaving dbo + user schemas.
    const result = await this.pool.request().query(`
      SELECT name
      FROM sys.schemas
      WHERE name NOT IN (
        'sys', 'INFORMATION_SCHEMA', 'guest',
        'db_owner', 'db_accessadmin', 'db_securityadmin', 'db_ddladmin',
        'db_backupoperator', 'db_datareader', 'db_datawriter',
        'db_denydatareader', 'db_denydatawriter'
      )
      ORDER BY name
    `);
    return (result.recordset as { name: string }[]).map((r) => r.name);
  }

  getTablesQuery(): ParameterizedQuery {
    return SQLServerQueries.tables(this.schemaName());
  }

  getColumnsQuery(tableName: string): ParameterizedQuery {
    return SQLServerQueries.columnsForTable(tableName, this.schemaName());
  }

  getForeignKeysQuery(tableName: string): ParameterizedQuery {
    return SQLServerQueries.foreignKeysForTable(tableName, this.schemaName());
  }

  // SQL Server uses square brackets for identifiers
  escapeIdentifier(identifier: string): string {
    return `[${identifier.replace(/\]/g, ']]')}]`;
  }
}
