/**
 * Common type definitions used across the application.
 * These replace generic `any` types with specific, type-safe alternatives.
 */

/**
 * Represents a single cell value in a database query result.
 * Database values can be primitives or null.
 */
export type CellValue = string | number | boolean | null | Date;

/**
 * A row of cell values from a database query.
 */
export type DataRow = CellValue[];

/**
 * Multiple rows of data from a database query.
 */
export type DataRows = DataRow[];

/**
 * Parameter values for reports and API requests.
 * Supports all parameter types.
 */
export type ParameterValue = string | number | boolean | Date | null | undefined;

/**
 * Default value for a report parameter.
 */
export type ParameterDefaultValue = ParameterValue;

/**
 * OpenAI tool definition parameters object.
 */
export interface ToolParameterProperties {
  [key: string]: {
    type: string;
    description?: string;
    items?: { type: string };
    enum?: string[];
  };
}

/**
 * Generic record for JSON-like objects.
 */
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

/**
 * Schema table representation used in API responses.
 */
export interface SchemaTableResponse {
  name: string;
  aiDescription?: string;
  hidden?: boolean;
  isNew?: boolean;
  isModified?: boolean;
  columns: SchemaColumnResponse[];
}

/**
 * Schema column representation used in API responses.
 */
export interface SchemaColumnResponse {
  name: string;
  type: string;
  nullable?: boolean;
  primary_key?: boolean;
  foreign_key?: string;
  aiDescription?: string;
  hidden?: boolean;
  isNew?: boolean;
  isModified?: boolean;
}

/**
 * AI suggestion object returned from the dashboard API.
 */
export interface AISuggestion {
  id: string;
  title: string;
  description: string;
  naturalLanguageQuery: string;
  category?: string;
  priority?: number;
}
