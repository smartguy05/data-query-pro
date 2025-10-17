import postgres from "postgres"
import mysql from "mysql2/promise"
import sql from "mssql"
import Database from "better-sqlite3"

interface DatabaseConnection {
  type: "postgresql" | "mysql" | "sqlserver" | "sqlite"
  host: string
  port: string
  database: string
  username: string
  password: string
}

export interface QueryResult {
  columns: string[]
  rows: string[][]
  rowCount: number
}

export async function executeQuery(connection: DatabaseConnection, query: string): Promise<QueryResult> {
  switch (connection.type) {
    case "postgresql":
      return executePostgreSQLQuery(connection, query)
    case "mysql":
      return executeMySQLQuery(connection, query)
    case "sqlserver":
      return executeSQLServerQuery(connection, query)
    case "sqlite":
      return executeSQLiteQuery(connection, query)
    default:
      throw new Error(`Unsupported database type: ${connection.type}`)
  }
}

async function executePostgreSQLQuery(connection: DatabaseConnection, query: string): Promise<QueryResult> {
  const pgClient = postgres({
    host: connection.host,
    port: Number.parseInt(connection.port),
    database: connection.database,
    username: connection.username,
    password: connection.password,
    ssl: connection.host.includes("azure") ? { rejectUnauthorized: false } : false,
  })

  try {
    const result = await pgClient.unsafe(query)
    const columns = result.length > 0 ? Object.keys(result[0]) : []
    const rows = result.map((row) =>
      columns.map((col) => {
        const value = row[col]
        if (value === null) return "NULL"
        if (value instanceof Date) return value.toISOString().split("T")[0]
        if (typeof value === "number") return value.toString()
        return String(value)
      }),
    )

    return {
      columns,
      rows,
      rowCount: result.length,
    }
  } finally {
    await pgClient.end()
  }
}

async function executeMySQLQuery(connection: DatabaseConnection, query: string): Promise<QueryResult> {
  const mysqlConnection = await mysql.createConnection({
    host: connection.host,
    port: Number.parseInt(connection.port),
    database: connection.database,
    user: connection.username,
    password: connection.password,
  })

  try {
    const [results] = await mysqlConnection.execute(query)
    const resultArray = Array.isArray(results) ? results : []

    const columns = resultArray.length > 0 ? Object.keys(resultArray[0]) : []
    const rows = resultArray.map((row: any) =>
      columns.map((col) => {
        const value = row[col]
        if (value === null) return "NULL"
        if (value instanceof Date) return value.toISOString().split("T")[0]
        if (typeof value === "number") return value.toString()
        if (Buffer.isBuffer(value)) return value.toString("utf-8")
        return String(value)
      }),
    )

    return {
      columns,
      rows,
      rowCount: resultArray.length,
    }
  } finally {
    await mysqlConnection.end()
  }
}

async function executeSQLServerQuery(connection: DatabaseConnection, query: string): Promise<QueryResult> {
  const config: sql.config = {
    server: connection.host,
    port: Number.parseInt(connection.port),
    database: connection.database,
    user: connection.username,
    password: connection.password,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  }

  const pool = new sql.ConnectionPool(config)

  try {
    await pool.connect()
    const result = await pool.request().query(query)

    const columns = result.recordset.columns ? Object.keys(result.recordset.columns) : []
    const rows = result.recordset.map((row: any) =>
      columns.map((col) => {
        const value = row[col]
        if (value === null) return "NULL"
        if (value instanceof Date) return value.toISOString().split("T")[0]
        if (typeof value === "number") return value.toString()
        return String(value)
      }),
    )

    return {
      columns,
      rows,
      rowCount: result.recordset.length,
    }
  } finally {
    await pool.close()
  }
}

async function executeSQLiteQuery(connection: DatabaseConnection, query: string): Promise<QueryResult> {
  // For SQLite, the database field contains the file path
  const db = new Database(connection.database)

  try {
    const stmt = db.prepare(query)
    const results = stmt.all()

    const columns = results.length > 0 ? Object.keys(results[0]) : []
    const rows = results.map((row: any) =>
      columns.map((col) => {
        const value = row[col]
        if (value === null) return "NULL"
        if (typeof value === "number") return value.toString()
        return String(value)
      }),
    )

    return {
      columns,
      rows,
      rowCount: results.length,
    }
  } finally {
    db.close()
  }
}
