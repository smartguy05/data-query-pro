export function generateTableDescription(tableName: string, columns: any[], databaseDescription?: string): string {
  const columnNames = columns.map((col) => col.name.toLowerCase())

  // Enhanced business domain detection with database context
  if (databaseDescription) {
    const context = databaseDescription.toLowerCase()
    if (context.includes("e-commerce") || context.includes("retail")) {
      if (columnNames.includes("price") || columnNames.includes("amount")) {
        return `Stores ${tableName.replace("_", " ")} information for e-commerce transactions and pricing`
      }
      if (columnNames.includes("quantity") || columnNames.includes("stock")) {
        return `Manages ${tableName.replace("_", " ")} inventory and stock levels for retail operations`
      }
    }
    if (context.includes("crm") || context.includes("customer")) {
      if (columnNames.includes("email") || columnNames.includes("phone")) {
        return `Contains ${tableName.replace("_", " ")} contact information for customer relationship management`
      }
    }
  }

  // Existing fallback logic
  if (columnNames.includes("email") && columnNames.includes("password")) {
    return `Stores user account information and authentication credentials for system access`
  }
  if (columnNames.includes("amount") || columnNames.includes("price") || columnNames.includes("total")) {
    return `Contains financial transaction data and monetary information for business operations`
  }
  if (columnNames.includes("quantity") || columnNames.includes("stock")) {
    return `Manages inventory levels and stock quantities for product availability tracking`
  }
  if (columnNames.includes("order_date") || columnNames.includes("created_at")) {
    return `Tracks ${tableName.replace("_", " ")} records with timestamps for business process management`
  }

  return `Stores ${tableName.replace("_", " ")} data for business operations and record keeping`
}

export function generateColumnDescription(
  tableName: string,
  columnName: string,
  columnType: string,
  isPrimaryKey?: boolean,
  foreignKey?: string,
  databaseDescription?: string,
): string {
  const name = columnName.toLowerCase()

  if (isPrimaryKey) return `Unique identifier for each ${tableName.slice(0, -1)} record`
  if (foreignKey) return `References ${foreignKey.replace("_", " ")} for data relationship`
  if (name === "created_at") return "Timestamp when this record was first created"
  if (name === "updated_at") return "Timestamp of the most recent update to this record"
  if (name === "deleted_at") return "Soft delete timestamp for record archival"
  if (name.includes("email")) return "Email address for communication and identification"
  if (name.includes("password")) return "Encrypted password for authentication security"
  if (name.includes("phone")) return "Contact phone number for communication"
  if (name.includes("address")) return "Physical or mailing address information"
  if (name.includes("name") || name.includes("title")) return "Display name or descriptive title"
  if (name.includes("amount") || name.includes("price") || name.includes("cost"))
    return "Monetary value in system currency"
  if (name.includes("quantity") || name.includes("count")) return "Numeric quantity or count value"
  if (name.includes("status")) return "Current operational status or state"
  if (name.includes("date")) return "Date value for temporal tracking"
  if (name.includes("description") || name.includes("notes")) return "Descriptive text or additional notes"

  return `${columnName.replace(/_/g, " ")} data stored as ${columnType}`
}
