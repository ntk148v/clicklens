/**
 * Discover Query Builder Types
 *
 * Type definitions for the Discover feature query builder module.
 */

export interface DiscoverQueryParams {
  database: string;
  table: string;
  mode: "data" | "histogram";
  columns?: string[];
  timeColumn?: string;
  minTime?: string;
  maxTime?: string;
  filter?: string;
  limit: number;
  offset: number;
  orderBy?: string;
  groupBy?: string;
  search?: string;
}

export interface TableMetadata {
  database: string;
  table: string;
  engine: string;
  clusterName?: string;
  isDistributed: boolean;
  tableSource: string;
}

export interface HistogramQueryResult {
  query: string;
  isDateOnly: boolean;
}

export interface DataQueryResult {
  query: string;
  countQuery: string;
  selectClause: string;
  groupByClause: string;
  orderByClause: string;
  whereClause: string;
}

export interface QueryBuilderOptions {
  validateSQL?: boolean;
  enableSmartSearch?: boolean;
}

export interface SortDirection {
  column: string;
  direction: "ASC" | "DESC";
}

export interface ValidationError {
  valid: false;
  error: string;
}

export interface ValidationSuccess {
  valid: true;
}

export type ValidationResult = ValidationError | ValidationSuccess;