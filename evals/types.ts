// Shared contracts for the NL→SQL eval harness. Standalone from the app's
// models/ on purpose — the harness is a CLI client of the HTTP API, not app code.

export type ComparisonMode =
  | "scalar" // exactly 1 row; one generated column numeric-equals the golden value
  | "ordered" // golden has a deterministic ORDER BY; row order must match
  | "unordered" // multiset match on golden columns
  | "row-count" // only the number of rows must match
  | "non-empty"; // >= 1 row passes (ambiguous questions)

export interface EvalQuestion {
  id: string; // "Q01"
  question: string; // NL prompt sent to /api/query/generate
  goldenSql: string; // authored reference SQL, executed via /api/query/execute
  mode: ComparisonMode;
  /** NOW()-relative golden: re-execute it immediately before each trial's comparison. */
  volatile?: boolean;
  tags: string[]; // "count" | "join" | "group-by" | "date" | "view" | "null" | "top-n" | "ambiguous" | ...
}

export type FailureClass =
  | "generation-mock-fallback" // route's outer catch: HTTP 200 mock (warning contains "mock response")
  | "generation-error" // generate returned non-200 (e.g. OpenAI status !== "completed" → 500)
  | "json-parse-fallback" // sql === "SELECT 1 as parsing_error" or warning "Could not parse OpenAI response as JSON"
  | "validation-rejection" // execute → HTTP 400 (AST read-only validator)
  | "execution-error" // execute → other non-200
  | "empty-result" // execute 200 but rowCount === 0
  | "result-mismatch"; // executed fine but result set does not match golden

export interface GenerateResponse {
  sql?: string;
  explanation?: string;
  confidence?: number;
  warnings?: unknown[];
  newFileId?: string;
  newVectorStoreId?: string;
  schemaReuploaded?: boolean;
  error?: string;
}

export interface ExecuteSuccess {
  columns: string[];
  rows: string[][]; // cells stringified by the server; SQL NULL is the literal "NULL"
  rowCount: number;
  executionTime: number;
  limitApplied?: boolean;
}

export interface ResultSet {
  columns: string[];
  rows: string[][];
}

export interface TrialResult {
  runId: string;
  model: string;
  questionId: string;
  trial: number; // 1-based
  question: string;
  tags: string[];
  mode: ComparisonMode;
  generatedSql: string | null;
  confidence: number | null;
  warnings: string[];
  generateMs: number;
  executeMs: number | null;
  rowCount: number | null;
  pass: boolean;
  failureClass: FailureClass | null; // null when pass
  failureDetail: string | null; // sanitized error / mismatch description; never credentials
  timestamp: string; // ISO
}

export interface DbConnectionConfig {
  type: "postgresql";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface RunConfig {
  models: string[];
  trials: number;
  baseUrl: string;
  questionIds: string[] | null; // null = all
  concurrency: number;
  db: DbConnectionConfig;
  /** Podman container to auto-start/reseed/stop for the demo DB ("" disables management). */
  dbContainer?: string | null;
}

export interface ComparisonOutcome {
  match: boolean;
  detail: string | null; // human-readable reason on mismatch
}
