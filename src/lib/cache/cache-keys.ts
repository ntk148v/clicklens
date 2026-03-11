/**
 * Cache Key Generators
 *
 * Generates consistent cache keys for different types of queries.
 */

import { createHash } from "crypto";

/**
 * Generate a hash from a string value
 */
function hashValue(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

/**
 * Generate cache key for histogram query
 */
export function getHistogramCacheKey(
  database: string,
  table: string,
  filter: string,
  minTime?: string,
  maxTime?: string,
): string {
  const filterHash = filter ? hashValue(filter) : "none";
  const timeRange = minTime && maxTime ? `${minTime}-${maxTime}` : "all";
  return `histogram:${database}:${table}:${filterHash}:${timeRange}`;
}

/**
 * Generate cache key for field values query
 */
export function getFieldValuesCacheKey(
  database: string,
  table: string,
  field: string,
  filter: string,
): string {
  const filterHash = filter ? hashValue(filter) : "none";
  return `field-values:${database}:${table}:${field}:${filterHash}`;
}

/**
 * Generate cache key for schema query
 */
export function getSchemaCacheKey(database: string, table: string): string {
  return `schema:${database}:${table}`;
}

/**
 * Generate cache key for data query
 */
export function getDataCacheKey(
  database: string,
  table: string,
  filter: string,
  columns: string[],
  orderBy?: string,
  groupBy?: string,
  limit?: number,
  offset?: number,
): string {
  const filterHash = filter ? hashValue(filter) : "none";
  const columnsStr = columns.sort().join(",");
  const orderByStr = orderBy || "none";
  const groupByStr = groupBy || "none";
  const limitStr = limit?.toString() || "100";
  const offsetStr = offset?.toString() || "0";

  const keyParts = [
    "data",
    database,
    table,
    filterHash,
    columnsStr,
    orderByStr,
    groupByStr,
    limitStr,
    offsetStr,
  ];

  return keyParts.join(":");
}

/**
 * Generate cache key pattern for invalidating all queries for a table
 */
export function getTableCachePattern(database: string, table: string): string {
  return `*:${database}:${table}:*`;
}

/**
 * Generate cache key pattern for invalidating all histogram queries for a table
 */
export function getHistogramCachePattern(database: string, table: string): string {
  return `histogram:${database}:${table}:*`;
}

/**
 * Generate cache key pattern for invalidating all field values queries for a table
 */
export function getFieldValuesCachePattern(database: string, table: string): string {
  return `field-values:${database}:${table}:*`;
}