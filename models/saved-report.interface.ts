export interface ReportParameter {
  name: string;
  type: 'text' | 'number' | 'date' | 'datetime' | 'boolean';
  label: string;
  defaultValue?: any;
  description?: string;
}

export interface SavedReport {
  id: string;
  connectionId: string;
  name: string;
  description?: string;

  // Query information
  naturalLanguageQuery: string;  // Original prompt
  sql: string;                   // Generated SQL (may contain {{parameters}})
  explanation: string;           // AI explanation
  warnings: string[];            // Any warnings
  confidence: number;            // AI confidence score

  // Parameters
  parameters?: ReportParameter[];

  // Metadata
  createdAt: string;
  lastModified: string;
  lastRun?: string;

  // Sharing (multi-user mode)
  createdBy?: string;       // User ID of report creator
  isShared?: boolean;       // Whether report is visible to other users

  // Future: visualization settings
  isFavorite?: boolean;
}
