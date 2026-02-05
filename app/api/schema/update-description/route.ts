import { type NextRequest, NextResponse } from "next/server"
import { getAuthContext } from '@/lib/auth/require-auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const { tableName, columnName, description } = await request.json()
    
    const activeConnection = localStorage.getItem("currentDbConnection")
    let connection;

    if (!!activeConnection) {
      try {
        connection = JSON.parse(activeConnection);
      } catch (error) {
        console.error("Failed to parse connection or schema data:", error);
      }
    } else {
      throw new Error("No active connection!");
    }
    connection.vectorStoreId = undefined;
    connection.schemaFileId = undefined;
    localStorage.setItem("currentDbConnection", JSON.stringify(connection));

    const cacheKey = `schema_${connection.id}`
    const cachedSchema = localStorage.getItem(cacheKey)
    let schemaData;
    if (cachedSchema) {
      schemaData = JSON.parse(cachedSchema)
    }

    if (!schemaData) {
      throw new Error("No schema data found! Be sure to parse database schema before trying to upload.");
    }
    
    const table = schemaData.tables.find((table) => table.name === tableName);
    if (!table) {
      throw new Error("No table found for schema data!");
    }
    const column = table.columns.find((column) => column.name === columnName);
    if (!column) {
      throw new Error("No column found for schema data!");
    }
    
    column.aiDescription = description;
    console.log("Updating description:", { tableName, columnName, description })
    localStorage.setItem(cacheKey, JSON.stringify(schemaData));
    
    return NextResponse.json({
      success: true,
      message: "Description updated successfully",
    })
  } catch (error) {
    console.error("Description update error:", error)
    return NextResponse.json({ error: "Failed to update description" }, { status: 500 })
  }
}
