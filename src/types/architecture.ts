/**
 * Architecture Type Definitions
 *
 * Core types for the new performance-focused architecture.
 * Defines the foundational interfaces for virtualization, caching, and state management.
 */

/**
 * Core application configuration
 */
export interface AppConfig {
  /** Application name */
  name: string;
  /** Version string */
  version: string;
  /** Environment (development, staging, production) */
  environment: "development" | "staging" | "production";
  /** Feature flags */
  features: FeatureFlags;
  /** API configuration */
  api: ApiConfig;
  /** Cache configuration */
  cache: CacheConfig;
}

/**
 * Feature flags for toggling functionality
 */
export interface FeatureFlags {
  /** Enable query result caching */
  enableQueryCache: boolean;
  /** Enable Redis-based distributed caching */
  enableRedisCache: boolean;
  /** Enable virtualization for large datasets */
  enableVirtualization: boolean;
  /** Enable query analytics */
  enableQueryAnalytics: boolean;
  /** Enable real-time metrics */
  enableRealtimeMetrics: boolean;
  /** Enable optimistic updates */
  enableOptimisticUpdates: boolean;
}

/**
 * API endpoint configuration
 */
export interface ApiConfig {
  /** Base URL for ClickHouse API */
  clickhouseBaseUrl: string;
  /** API timeout in milliseconds */
  timeout: number;
  /** Maximum concurrent requests */
  maxConcurrentRequests: number;
  /** Request retry configuration */
  retry: RetryConfig;
}

/**
 * Retry configuration for failed requests
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay between retries in milliseconds */
  baseDelay: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay: number;
  /** Exponential backoff factor */
  backoffFactor: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Maximum entries in LRU cache */
  maxEntries: number;
  /** Default TTL in milliseconds */
  defaultTTL: number;
  /** Enable cache statistics tracking */
  enableStats: boolean;
  /** Cache key prefix */
  keyPrefix: string;
}

/**
 * Data fetch strategy
 */
export type FetchStrategy = "eager" | "lazy" | "streaming";

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  /** Number of items per page */
  pageSize: number;
  /** Maximum number of pages to prefetch */
  prefetchPages: number;
  /** Enable infinite scroll */
  infiniteScroll: boolean;
}

/**
 * Row data type for data grids
 */
export interface RowData {
  /** Unique row identifier */
  id: string | number;
  /** Row data as key-value pairs */
  [key: string]: unknown;
}

/**
 * Column definition for data grids
 */
export interface ColumnDef<T extends RowData = RowData> {
  /** Column key/field name */
  key: keyof T | string;
  /** Display label */
  label: string;
  /** Column width in pixels */
  width?: number;
  /** Minimum column width */
  minWidth?: number;
  /** Maximum column width */
  maxWidth?: number;
  /** Enable sorting */
  sortable?: boolean;
  /** Enable filtering */
  filterable?: boolean;
  /** Custom render function */
  render?: (value: unknown, row: T) => React.ReactNode;
  /** Data type for formatting */
  dataType?: "string" | "number" | "boolean" | "date" | "json";
}

/**
 * Sort configuration
 */
export interface SortConfig {
  /** Field to sort by */
  field: string;
  /** Sort direction */
  direction: "asc" | "desc";
}

/**
 * Filter configuration
 */
export interface FilterConfig {
  /** Field to filter by */
  field: string;
  /** Filter operator */
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "startsWith" | "endsWith" | "in";
  /** Filter value */
  value: unknown;
  /** Filter logic */
  logic?: "and" | "or";
}

/**
 * Combined filter state
 */
export interface FilterState {
  /** Active filters */
  filters: FilterConfig[];
  /** Sort configuration */
  sort: SortConfig | null;
  /** Search query */
  search: string;
}

/**
 * Time range for queries
 */
export interface TimeRange {
  /** Start timestamp */
  start: number;
  /** End timestamp */
  end: number;
  /** Preset name (e.g., "last_1_hour", "today") */
  preset?: string;
}

/**
 * Data source identifier
 */
export interface DataSource {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Database name */
  database: string;
  /** Table name */
  table: string;
}

/**
 * Query context for tracking
 */
export interface QueryContext {
  /** Query ID */
  queryId: string;
  /** Data source */
  dataSource: DataSource;
  /** Time range */
  timeRange?: TimeRange;
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result set metadata
 */
export interface ResultSetMetadata {
  /** Total number of rows */
  totalRows: number;
  /** Number of rows returned */
  returnedRows: number;
  /** Number of columns */
  columnCount: number;
  /** Column definitions */
  columns: ColumnDef[];
  /** Query execution time in milliseconds */
  executionTime: number;
  /** Whether results were served from cache */
  cached: boolean;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** HTTP status code */
  status: number;
  /** Additional details */
  details?: Record<string, unknown>;
  /** Stack trace (development only) */
  stack?: string;
}

/**
 * Success response wrapper
 */
export interface SuccessResponse<T> {
  /** Response data */
  data: T;
  /** Metadata */
  metadata?: ResultSetMetadata;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  /** Array of items */
  items: T[];
  /** Current page number */
  page: number;
  /** Page size */
  pageSize: number;
  /** Total number of items */
  total: number;
  /** Whether there are more pages */
  hasMore: boolean;
}
