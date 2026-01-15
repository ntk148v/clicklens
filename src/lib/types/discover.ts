/**
 * Types for the Discover feature
 *
 * Enables exploration of any ClickHouse table, not just system logs.
 */

/**
 * Column metadata returned from schema introspection
 */
export interface ColumnMetadata {
  name: string;
  type: string; // ClickHouse type (String, DateTime64, UInt64, etc.)
  isNullable: boolean;
  defaultKind: string; // DEFAULT, MATERIALIZED, ALIAS, etc.
  comment: string;
}

/**
 * Detected time column candidate
 */
export interface TimeColumnCandidate {
  name: string;
  type: string;
  isPrimary: boolean; // Is part of ORDER BY / primary key
}

/**
 * Schema information for a table
 */
export interface TableSchema {
  database: string;
  table: string;
  engine: string;
  columns: ColumnMetadata[];
  timeColumns: TimeColumnCandidate[];
  orderByColumns: string[];
  partitionKey: string | null;
}

/**
 * Data source configuration for Discover
 */
export interface DataSourceConfig {
  database: string;
  table: string;
  timeColumn: string;
  selectedColumns: string[];
}

/**
 * Query parameters for Discover API
 */
export interface DiscoverQueryParams {
  database: string;
  table: string;
  columns: string[];
  timeColumn: string;
  minTime?: string;
  maxTime?: string;
  filter?: string; // User's custom WHERE expression
  limit: number;
  cursor?: string; // For pagination: "timestamp_uniqueId"
}

/**
 * Single row of discover results
 */
export type DiscoverRow = Record<string, unknown>;

/**
 * Response from Discover API
 */
export interface DiscoverResponse {
  success: boolean;
  data?: {
    rows: DiscoverRow[];
    totalHits: number;
    cursor: string | null; // Cursor for next page, null if no more data
    executedQuery?: string; // For debugging
  };
  histogram?: { time: string; count: number }[];
  error?: string;
}

/**
 * Available time ranges for the time picker
 */
export type TimeRange =
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "3h"
  | "6h"
  | "12h"
  | "24h"
  | "3d"
  | "7d"
  | "custom";

/**
 * Calculate minTime from a TimeRange
 */
export function getMinTimeFromRange(range: TimeRange): Date | null {
  if (range === "custom") return null;

  const now = new Date();
  const mapping: Record<Exclude<TimeRange, "custom">, number> = {
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "30m": 30 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "3h": 3 * 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "3d": 3 * 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  };

  return new Date(now.getTime() - mapping[range]);
}

/**
 * Helper to parse cursor string
 */
export function parseCursor(cursor: string): {
  timestamp: string;
  id: string;
} | null {
  const parts = cursor.split("_");
  if (parts.length < 2) return null;
  const id = parts.pop()!;
  const timestamp = parts.join("_"); // Handle ISO timestamps with underscores
  return { timestamp, id };
}

/**
 * Helper to create cursor string
 */
export function createCursor(timestamp: string, id: string): string {
  return `${timestamp}_${id}`;
}
