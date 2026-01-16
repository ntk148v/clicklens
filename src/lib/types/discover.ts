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
    nextCursor: string | null; // Cursor for next page
    hasMore: boolean;
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
  | "7d";

export interface FlexibleTimeRange {
  type: "relative" | "absolute";
  // For relative: "15m", "1h", etc.
  // For absolute: ISO strings
  from: string;
  to: string | "now";
  label: string; // Display label like "Last 15 minutes" or "Jan 1, 10:00 - Jan 2, 10:00"
}

export function getFlexibleRangeFromEnum(range: TimeRange): FlexibleTimeRange {
  const labels: Record<TimeRange, string> = {
    "5m": "Last 5 minutes",
    "15m": "Last 15 minutes",
    "30m": "Last 30 minutes",
    "1h": "Last 1 hour",
    "3h": "Last 3 hours",
    "6h": "Last 6 hours",
    "12h": "Last 12 hours",
    "24h": "Last 24 hours",
    "3d": "Last 3 days",
    "7d": "Last 7 days",
  };

  return {
    type: "relative",
    from: `now-${range}`,
    to: "now",
    label: labels[range],
  };
}

/**
 * Calculate minTime from a TimeRange
 */
export function getMinTimeFromRange(range: TimeRange): Date | null {
  const now = new Date();
  const mapping: Record<TimeRange, number> = {
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
  timestamp: string; // ISO string
  id: string; // secondary sort key
} | null {
  try {
    const decoded = atob(cursor);
    const parts = decoded.split("::");
    if (parts.length < 2) return null;
    // Format: timestamp::id
    // If ID contains ::, we only split on the first one? No, ID might be last.
    // Let's assume timestamp is always first.
    // Actually safe split:
    const timestamp = parts[0];
    const id = parts.slice(1).join("::");
    return { timestamp, id };
  } catch {
    return null;
  }
}

/**
 * Helper to create cursor string
 */
export function createCursor(timestamp: string, id: string): string {
  // Simple delimiter that is unlikely to be in ISO timestamp
  return btoa(`${timestamp}::${id}`);
}
