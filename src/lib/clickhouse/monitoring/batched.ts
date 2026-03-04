/**
 * Batched Dashboard Queries
 *
 * Combines 18 individual dashboard time-series queries into 2 batched queries:
 * 1. metric_log batch: 12 metrics in a single query with multiple SELECT columns
 * 2. asynchronous_metric_log batch: 6 metrics with conditional aggregation
 *
 * This reduces ClickHouse round-trips from 18 to 2 per dashboard refresh.
 */

import { type DashboardQuery } from "./queries";

// Common WHERE clause (same as queries.ts)
const TIME_RANGE_WHERE = `event_date >= toDate(parseDateTimeBestEffort({from:String})) AND event_date <= toDate(parseDateTimeBestEffort({to:String}))
  AND event_time >= parseDateTimeBestEffort({from:String}) AND event_time <= parseDateTimeBestEffort({to:String})`;

// ---------------------------------------------------------------------------
// Batched metric_log query (12 metrics in 1 query)
// ---------------------------------------------------------------------------

/**
 * Row shape returned by the batched metric_log query.
 * Each row contains all 12 metric values for a given (t, node) pair.
 */
export type MetricLogBatchRow = {
  t: string;
  node: string;
  queries_per_sec: number;
  queries_running: number;
  merges_running: number;
  selected_rows: number;
  inserted_rows: number;
  selected_bytes: number;
  inserted_bytes: number;
  memory_tracking: number;
  io_wait: number;
  network_connections: number;
  disk_read: number;
  disk_write: number;
};

/**
 * Returns a single query that fetches all 12 metric_log metrics at once.
 * Replaces 12 individual getDashboard*Query calls.
 */
export const getDashboardMetricLogBatchQuery = (
  from: string,
  to: string,
  rounding: number,
  clusterName?: string,
): DashboardQuery => {
  const columns = `
  toStartOfInterval(event_time, INTERVAL {rounding:UInt32} SECOND) AS t,
  ${clusterName ? "hostname" : "hostName()"} AS node,
  avg(ProfileEvent_Query) AS queries_per_sec,
  avg(CurrentMetric_Query) AS queries_running,
  avg(CurrentMetric_Merge) AS merges_running,
  avg(ProfileEvent_SelectedRows) AS selected_rows,
  avg(ProfileEvent_InsertedRows) AS inserted_rows,
  avg(ProfileEvent_SelectedBytes) AS selected_bytes,
  avg(ProfileEvent_InsertedBytes) AS inserted_bytes,
  avg(CurrentMetric_MemoryTracking) AS memory_tracking,
  avg(ProfileEvent_OSIOWaitMicroseconds) / 1000000 AS io_wait,
  avg(CurrentMetric_TCPConnection + CurrentMetric_HTTPConnection + CurrentMetric_MySQLConnection) AS network_connections,
  avg(ProfileEvent_OSReadBytes) AS disk_read,
  avg(ProfileEvent_OSWriteBytes) AS disk_write`;

  const query = clusterName
    ? `SELECT ${columns}
FROM clusterAllReplicas('${clusterName}', merge('system', '^metric_log'))
WHERE ${TIME_RANGE_WHERE}
GROUP BY t, node
ORDER BY t, node
SETTINGS skip_unavailable_shards = 1`
    : `SELECT ${columns}
FROM merge('system', '^metric_log')
WHERE ${TIME_RANGE_WHERE}
GROUP BY t, node
ORDER BY t, node`;

  return { query, query_params: { from, to, rounding } };
};

// ---------------------------------------------------------------------------
// Batched asynchronous_metric_log query (6 metrics in 1 query)
// ---------------------------------------------------------------------------

/**
 * Row shape returned by the batched async_metric_log query.
 * Each row contains one metric's value for a given (t, node, metric_name) triple.
 */
export type AsyncMetricLogBatchRow = {
  t: string;
  node: string;
  metric_name: string;
  value: number;
};

/**
 * Returns a single query that fetches all 6 asynchronous_metric_log metrics.
 * Uses conditional grouping to handle both exact matches and LIKE patterns.
 * Replaces 6 individual getDashboard*Query calls.
 */
export const getDashboardAsyncMetricLogBatchQuery = (
  from: string,
  to: string,
  rounding: number,
  clusterName?: string,
): DashboardQuery => {
  // Map each metric to a canonical name for the result.
  // Network metrics use LIKE patterns, others use exact matches.
  const metricMapping = `
    multiIf(
      metric = 'MaxPartCountForPartition', 'max_parts',
      metric = 'OSUserTimeNormalized', 'cpu_user',
      metric = 'OSSystemTimeNormalized', 'cpu_kernel',
      metric = 'FilesystemMainPathUsedBytes', 'filesystem',
      metric LIKE 'NetworkReceiveBytes%', 'network_recv',
      metric LIKE 'NetworkSendBytes%', 'network_send',
      'unknown'
    ) AS metric_name`;

  // MaxPartCountForPartition uses max(), all others use avg()
  const aggregation = `
    if(metric_name = 'max_parts', max(value), avg(value)) AS value`;

  const whereMetric = `AND (
    metric IN ('MaxPartCountForPartition', 'OSUserTimeNormalized', 'OSSystemTimeNormalized', 'FilesystemMainPathUsedBytes')
    OR metric LIKE 'NetworkReceiveBytes%'
    OR metric LIKE 'NetworkSendBytes%'
  )`;

  const query = clusterName
    ? `SELECT
  toStartOfInterval(event_time, INTERVAL {rounding:UInt32} SECOND) AS t,
  hostname AS node,
  ${metricMapping},
  ${aggregation}
FROM clusterAllReplicas('${clusterName}', merge('system', '^asynchronous_metric_log'))
WHERE ${TIME_RANGE_WHERE}
  ${whereMetric}
GROUP BY t, node, metric_name
HAVING metric_name != 'unknown'
ORDER BY t, node, metric_name
SETTINGS skip_unavailable_shards = 1`
    : `SELECT
  toStartOfInterval(event_time, INTERVAL {rounding:UInt32} SECOND) AS t,
  hostName() AS node,
  ${metricMapping},
  ${aggregation}
FROM merge('system', '^asynchronous_metric_log')
WHERE ${TIME_RANGE_WHERE}
  ${whereMetric}
GROUP BY t, node, metric_name
HAVING metric_name != 'unknown'
ORDER BY t, node, metric_name`;

  return { query, query_params: { from, to, rounding } };
};
