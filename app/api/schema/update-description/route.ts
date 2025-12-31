import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/auth/api-auth"

/**
 * Update description for a table or column in the schema.
 *
 * This endpoint accepts the schema data in the request body and returns
 * the updated schema. The client is responsible for persisting the changes.
 *
 * Request body:
 * - connectionId: string (required)
 * - tableName: string (required)
 * - columnName?: string (optional - if not provided, updates table description)
 * - description: string (required)
 * - schema: Schema object (required - the current schema to update)
 *
 * Response:
 * - success: boolean
 * - schema: Updated schema object
 * - message: string
 */
export const POST = withAuth(async (request, { user }) => {
  try {
    const { connectionId, tableName, columnName, description, schema } = await request.json()

    // Validate required fields
    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required" }, { status: 400 })
    }
    if (!tableName) {
      return NextResponse.json({ error: "tableName is required" }, { status: 400 })
    }
    if (description === undefined) {
      return NextResponse.json({ error: "description is required" }, { status: 400 })
    }
    if (!schema) {
      return NextResponse.json({ error: "schema is required" }, { status: 400 })
    }

    // Validate schema belongs to this connection
    if (schema.connectionId !== connectionId) {
      return NextResponse.json({
        error: "Schema connectionId does not match the provided connectionId"
      }, { status: 400 })
    }

    // Find the table
    const table = schema.tables?.find((t: { name: string }) => t.name === tableName)
    if (!table) {
      return NextResponse.json({ error: `Table '${tableName}' not found in schema` }, { status: 404 })
    }

    if (columnName) {
      // Update column description
      const column = table.columns?.find((c: { name: string }) => c.name === columnName)
      if (!column) {
        return NextResponse.json({
          error: `Column '${columnName}' not found in table '${tableName}'`
        }, { status: 404 })
      }
      column.aiDescription = description
      console.log("Updated column description:", { tableName, columnName, description })
    } else {
      // Update table description
      table.aiDescription = description
      console.log("Updated table description:", { tableName, description })
    }

    return NextResponse.json({
      success: true,
      schema,
      message: columnName
        ? `Description for column '${columnName}' in table '${tableName}' updated successfully`
        : `Description for table '${tableName}' updated successfully`,
    })
  } catch (error) {
    console.error("Description update error:", error)
    return NextResponse.json({
      error: "Failed to update description",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}, { requireAdmin: true })
