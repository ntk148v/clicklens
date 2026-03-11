/**
 * Types for ClickHouse Discover Query Builder
 */

import type { DiscoverQueryParams, TableSchema } from "@/lib/types/discover";

/**
 * Query builder configuration
 */
export interface QueryBuilderConfig {
  database: string;
  table: string;
  tableSource: string; // Fully qualified table name with cluster if applicable
  timeColumn?: string;
  timeColumnType?: string; // DateTime, Date, Date32, etc.
}

/**
 * Histogram query options
 */
export interface HistogramOptions {
  minTime?: string;
  maxTime?: string;
  filter?: string;
  interval?: string; // Auto-calculated if not provided
}

/**
 * Data query options
 */
export interface DataQueryOptions {
  columns: string[];
  filter?: string;
  search?: string;
  minTime?: string;
  maxTime?: string;
  limit: number;
  offset: number;
  orderBy?: string;
  groupBy?: string;
}

/**
 * Count query options
 */
export interface CountQueryOptions {
  filter?: string;
  search?: string;
  minTime?: string;
  maxTime?: string;
  groupBy?: string;
}

/**
 * Built query result
 */
export interface BuiltQuery {
  query: string;
  params?: Record<string, unknown>;
}

/**
 * Query builder result with metadata
 */
export interface QueryBuilderResult {
  query: string;
  countQuery?: string;
  metadata?: {
    hasGroupBy: boolean;
    hasOrderBy: boolean;
    hasTimeFilter: boolean;
    hasFilter: boolean;
    hasSearch: boolean;
  };
}