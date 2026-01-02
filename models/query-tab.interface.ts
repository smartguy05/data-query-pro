/**
 * Query Tab interfaces for the follow-up questions feature.
 * Tracks state for original queries and follow-up questions in a tabbed UI.
 */

export type FollowUpResponseType = 'query' | 'explanation';
export type RowLimitOption = 'none' | 25 | 50 | 100 | 'all';

export interface QueryExecutionResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
}

export interface QueryResult {
  sql: string;
  explanation: string;
  confidence: number;
  warnings: string[];
}

export interface ExplanationResponse {
  text: string;
  confidence: number;
}

export interface QueryTab {
  id: string;
  type: 'original' | 'followup';
  question: string;
  parentTabId: string | null;

  // Generation state
  isGenerating: boolean;
  generationError?: string;

  // Query response (if AI generated SQL)
  queryResult?: QueryResult;
  editableSql?: string;

  // Explanation response (if AI explained)
  explanationResponse?: ExplanationResponse;

  // Execution state
  isExecuting: boolean;
  executionError?: string;
  executionResults?: QueryExecutionResult;

  // Response type determined by AI
  responseType?: FollowUpResponseType;

  // Timestamp for ordering
  createdAt: string;
}

export interface FollowUpRequest {
  followUpQuestion: string;
  originalQuestion: string;
  generatedSql: string;
  resultColumns: string[];
  resultRows: any[][];
  totalRowCount: number;
  vectorStoreId: string;
  databaseType: string;
  schemaData?: any;
  existingFileId?: string;
}

export interface FollowUpResponse {
  responseType: FollowUpResponseType;
  // If responseType is 'query'
  sql?: string;
  explanation?: string;
  confidence?: number;
  warnings?: string[];
  // If responseType is 'explanation'
  explanationText?: string;
  // If schema was re-uploaded
  schemaReuploaded?: boolean;
  newFileId?: string;
  newVectorStoreId?: string;
}
