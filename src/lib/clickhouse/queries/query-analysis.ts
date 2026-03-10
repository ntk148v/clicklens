/**
 * ClickHouse Query Analysis SQL Queries
 *
 * Centralized queries for query history, analytics (expensive queries),
 * and query cache inspection.
 */

// =============================================================================
// Query History
// =============================================================================

/** Get query history count */
export const getQueryHistoryCountQuery = (
  table: string,
  whereClause: string,
  settings: string,
) => `
SELECT count() as count FROM ${table} ${whereClause} ${settings}
`;

/** Get paginated query history */
export const getQueryHistoryQuery = (
  table: string,
  whereClause: string,
  nodeField: string,
  limit: number,
  offset: number,
  settings: string,
) => `
SELECT
  toString(event_time) as event_time,
  ${nodeField}
  query_id,
  query,
  query_kind,
  user,
  current_database,
  query_duration_ms,
  read_rows,
  read_bytes,
  written_rows,
  written_bytes,
  result_rows,
  memory_usage,
  type,
  exception_code,
  exception
FROM ${table}
${whereClause}
ORDER BY event_time DESC
LIMIT ${limit} OFFSET ${offset}
${settings}
`;

// =============================================================================
// Query Analytics (Expensive Queries)
// =============================================================================

/** Get expensive queries aggregated by normalized_query_hash */
export const getExpensiveQueriesQuery = (
  table: string,
  orderBy: string,
  limit: number,
  settings: string,
) => `
SELECT
  any(query) as query,
  toString(normalized_query_hash) as normalized_query_hash,
  any(user) as user,
  any(query_kind) as query_kind,
  count() as count,
  sum(query_duration_ms) as total_duration_ms,
  avg(query_duration_ms) as avg_duration_ms,
  max(query_duration_ms) as max_duration_ms,
  sum(memory_usage) as total_memory,
  avg(memory_usage) as avg_memory,
  max(memory_usage) as max_memory,
  sum(read_bytes) as total_read_bytes,
  avg(read_bytes) as avg_read_bytes,
  toString(max(event_time)) as last_event_time
FROM ${table}
WHERE type = 'QueryFinish'
  AND event_date >= today() - 7
GROUP BY normalized_query_hash
ORDER BY ${orderBy}
LIMIT ${limit}
${settings}
`;

/** Get query summary stats for the last 7 days */
export const getQuerySummaryQuery = (
  table: string,
  settings: string,
) => `
SELECT
  count() as total_queries,
  sum(query_duration_ms) as total_duration_ms,
  sum(memory_usage) as total_memory,
  sum(read_bytes) as total_read_bytes,
  countIf(exception_code != 0) as failed_queries
FROM ${table}
WHERE event_date >= today() - 7
${settings}
`;

// =============================================================================
// Query Cache
// =============================================================================

/** Get query cache entries */
export const getQueryCacheQuery = (
  table: string,
  nodeField: string,
  settings: string,
) => `
SELECT
  query,
  ${nodeField}
  query_id,
  result_size,
  stale,
  shared,
  compressed,
  toString(expires_at) as expires_at,
  toString(key_hash) as key_hash
FROM ${table}
ORDER BY result_size DESC
LIMIT 100
${settings}
`;
