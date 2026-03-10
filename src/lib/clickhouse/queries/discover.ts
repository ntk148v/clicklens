/**
 * ClickHouse Discover/Explore SQL Queries
 *
 * Centralized queries for field-value faceting in the discover page.
 *
 * Note: Histogram and streaming data queries remain inline in the
 * discover route because they are heavily dynamic (fetchChunks infrastructure).
 */

// =============================================================================
// Field Values (Faceted Exploration)
// =============================================================================

/** Get top distinct values for a column, used by field sidebar */
export const getFieldValuesQuery = (
  tableSource: string,
  quotedCol: string,
  whereClause: string,
  limit: number,
) =>
  `SELECT ${quotedCol} AS value, count() AS count FROM ${tableSource} ${whereClause} GROUP BY value ORDER BY count DESC LIMIT ${limit}`;
