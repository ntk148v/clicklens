/**
 * Query Type Definitions
 *
 * Types for query execution, management, and analysis.
 */

/**
 * Query request configuration
 */
export interface QueryRequest {
  query: string;
  database: string;
  settings?: QuerySettings;
  defaultFormat?: string;
}

/**
 * Query execution settings
 */
export interface QuerySettings {
  max_execution_time?: number;
  max_rows_to_read?: number;
  max_bytes_to_read?: number;
  max_columns_to_read?: number;
  prefer_localhost_replica?: boolean;
  distributed_product_mode?: "deny" | "local" | "global" | "allow";
  timeout_overflow_mode?: "throw" | "break";
}

/**
 * Query response structure
 */
export interface QueryResponse {
  data: unknown[];
  rows: number;
  statistics: QueryStatistics;
  meta: QueryMeta[];
}

/**
 * Query execution statistics
 */
export interface QueryStatistics {
  elapsed: number;
  rows_read: number;
  bytes_read: number;
  rows_before_aggregation?: number;
}

/**
 * Query metadata for columns
 */
export interface QueryMeta {
  name: string;
  type: string;
}

/**
 * Query status
 */
export type QueryStatus = "running" | "completed" | "failed" | "cancelled";

/**
 * Query state for tracking
 */
export interface QueryState {
  queryId: string;
  query: string;
  database: string;
  status: QueryStatus;
  startTime: number;
  endTime?: number;
  progress: number;
  result?: QueryResponse;
  error?: string;
}

/**
 * Query history entry
 */
export interface QueryHistoryEntry {
  id: string;
  query: string;
  database: string;
  timestamp: number;
  duration: number;
  rows: number;
  status: QueryStatus;
  error?: string;
  cached: boolean;
}

/**
 * Query tab state
 */
export interface QueryTab {
  id: string;
  title: string;
  query: string;
  database: string;
  result?: QueryResponse;
  isExecuting: boolean;
  error?: string;
  history: QueryHistoryEntry[];
}

/**
 * Query execution mode
 */
export type QueryExecutionMode = "synchronous" | "streaming" | "async";

/**
 * Query cancellation token
 */
export interface QueryCancellationToken {
  cancelled: boolean;
  cancel: () => void;
}

/**
 * Query parameters for prepared statements
 */
export interface QueryParameters {
  [key: string]: unknown;
}

/**
 * Query builder options
 */
export interface QueryBuilderOptions {
  database: string;
  table: string;
  columns?: string[];
  filters?: QueryFilter[];
  groupBy?: string[];
  orderBy?: QueryOrder[];
  limit?: number;
  offset?: number;
}

/**
 * Query filter condition
 */
export interface QueryFilter {
  column: string;
  operator: "=" | "!=" | ">" | ">=" | "<" | "<=" | "LIKE" | "IN" | "NOT IN" | "IS NULL" | "IS NOT NULL";
  value: unknown;
}

/**
 * Query order specification
 */
export interface QueryOrder {
  column: string;
  direction: "ASC" | "DESC";
}

/**
 * Saved query definition
 */
export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  query: string;
  database: string;
  category?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

/**
 * Query analysis result
 */
export interface QueryAnalysis {
  queryId: string;
  query: string;
  syntaxValid: boolean;
  estimatedRows?: number;
  estimatedBytes?: number;
  tables: string[];
  columns: string[];
  subqueries: number;
  hasAggregations: boolean;
  hasJoins: boolean;
  hasSubqueries: boolean;
  recommendations?: string[];
}

/**
 * Query profile information
 */
export interface QueryProfile {
  queryId: string;
  steps: QueryProfileStep[];
  totalTime: number;
}

/**
 * Query profile step
 */
export interface QueryProfileStep {
  name: string;
  number: number;
  time: number;
  rows: number;
  bytes: number;
}

/**
 * Query explanation
 */
export interface QueryExplain {
  query: string;
  database: string;
  explain: string;
  syntax_ok: boolean;
  formatted_query?: string;
}

/**
 * Query stream result
 */
export interface QueryStreamResult {
  chunk: unknown[];
  rows: number;
  finished: boolean;
}

/**
 * Query event types
 */
export type QueryEventType = "start" | "progress" | "data" | "error" | "end";

/**
 * Query event
 */
export interface QueryEvent {
  type: QueryEventType;
  queryId: string;
  timestamp: number;
  data?: unknown;
  progress?: number;
  error?: string;
}

/**
 * Query result formatter
 */
export type QueryResultFormatter = "json" | "jsonCompact" | "csv" | "tsv" | "pretty";

/**
 * Query validation result
 */
export interface QueryValidationResult {
  valid: boolean;
  errors: QueryValidationError[];
  warnings: QueryValidationWarning[];
}

/**
 * Query validation error
 */
export interface QueryValidationError {
  line: number;
  column: number;
  message: string;
}

/**
 * Query validation warning
 */
export interface QueryValidationWarning {
  line: number;
  column: number;
  message: string;
  code?: string;
}
