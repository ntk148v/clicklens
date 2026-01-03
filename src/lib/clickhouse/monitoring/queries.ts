/**
 * ClickHouse Monitoring SQL Queries
 * Pre-built queries for fetching monitoring data from system tables
 * 
 * Cluster-aware queries use clusterAllReplicas() to aggregate data from all nodes.
 * Single-node queries are also available as fallback.
 */

// =============================================================================
// Cluster Detection
// =============================================================================

// Get available clusters
export const CLUSTERS_LIST_QUERY = `
SELECT DISTINCT cluster FROM system.clusters ORDER BY cluster
`;

// =============================================================================
// Overview Queries - Categorized metrics (single node)
// =============================================================================

// Server category: basic server info
export const SERVER_INFO_QUERY = `
SELECT
  (SELECT value FROM system.asynchronous_metrics WHERE metric = 'Uptime') AS uptime,
  (SELECT version()) AS version,
  (SELECT value FROM system.metrics WHERE metric = 'TCPConnection') AS tcp_connections,
  (SELECT value FROM system.metrics WHERE metric = 'HTTPConnection') AS http_connections,
  (SELECT hostName()) AS hostname
`;

// Query category: query-related metrics
export const QUERY_METRICS_QUERY = `
SELECT
  (SELECT value FROM system.metrics WHERE metric = 'Query') AS running_queries,
  (SELECT value FROM system.metrics WHERE metric = 'QueryThread') AS query_threads,
  (SELECT value FROM system.metrics WHERE metric = 'QueryPreempted') AS preempted_queries,
  (SELECT coalesce(sum(value), 0) FROM system.events WHERE event IN ('Query', 'SelectQuery', 'InsertQuery')) AS total_queries,
  (SELECT coalesce(sum(value), 0) FROM system.events WHERE event = 'FailedQuery') AS failed_queries,
  (SELECT coalesce(sum(value), 0) FROM system.events WHERE event = 'SelectQuery') AS select_queries,
  (SELECT coalesce(sum(value), 0) FROM system.events WHERE event = 'InsertQuery') AS insert_queries
`;

// Memory category: memory-related metrics
export const MEMORY_METRICS_QUERY = `
SELECT
  (SELECT value FROM system.metrics WHERE metric = 'MemoryTracking') AS memory_used,
  (SELECT value FROM system.asynchronous_metrics WHERE metric = 'OSMemoryTotal') AS memory_total,
  (SELECT value FROM system.metrics WHERE metric = 'MergesMutationsMemoryTracking') AS merge_memory,
  (SELECT value FROM system.asynchronous_metrics WHERE metric = 'MemoryResident') AS memory_resident,
  (SELECT value FROM system.asynchronous_metrics WHERE metric = 'MemoryShared') AS memory_shared
`;

// Merge & Parts category
export const MERGE_METRICS_QUERY = `
SELECT
  (SELECT value FROM system.metrics WHERE metric = 'Merge') AS running_merges,
  (SELECT value FROM system.metrics WHERE metric = 'PartMutation') AS running_mutations,
  (SELECT value FROM system.metrics WHERE metric = 'BackgroundMergesAndMutationsPoolTask') AS background_pool_tasks,
  (SELECT value FROM system.asynchronous_metrics WHERE metric = 'MaxPartCountForPartition') AS max_parts_per_partition,
  (SELECT coalesce(sum(value), 0) FROM system.events WHERE event = 'MergedRows') AS merged_rows,
  (SELECT coalesce(sum(value), 0) FROM system.events WHERE event = 'MergedUncompressedBytes') AS merged_bytes
`;

// Throughput category: rows/bytes per second
export const THROUGHPUT_METRICS_QUERY = `
SELECT
  (SELECT coalesce(sum(value), 0) FROM system.events WHERE event = 'InsertedRows') AS inserted_rows,
  (SELECT coalesce(sum(value), 0) FROM system.events WHERE event = 'InsertedBytes') AS inserted_bytes,
  (SELECT coalesce(sum(value), 0) FROM system.events WHERE event = 'SelectedRows') AS selected_rows,
  (SELECT coalesce(sum(value), 0) FROM system.events WHERE event = 'SelectedBytes') AS selected_bytes
`;

// CPU & IO category
export const CPU_IO_METRICS_QUERY = `
SELECT
  (SELECT value FROM system.asynchronous_metrics WHERE metric = 'OSUserTimeCPU') AS cpu_user,
  (SELECT value FROM system.asynchronous_metrics WHERE metric = 'OSSystemTimeCPU') AS cpu_system,
  (SELECT value FROM system.asynchronous_metrics WHERE metric = 'OSIOWaitTimeCPU') AS io_wait,
  (SELECT coalesce(sum(value), 0) FROM system.events WHERE event = 'ReadBufferFromFileDescriptorReadBytes') AS disk_read_bytes,
  (SELECT coalesce(sum(value), 0) FROM system.events WHERE event = 'WriteBufferFromFileDescriptorWriteBytes') AS disk_write_bytes
`;

// Combined overview query for dashboard
export const OVERVIEW_QUERY = `
SELECT
  (SELECT value FROM system.asynchronous_metrics WHERE metric = 'Uptime') AS uptime,
  (SELECT version()) AS version,
  (SELECT value FROM system.metrics WHERE metric = 'Query') AS active_queries,
  (SELECT value FROM system.metrics WHERE metric = 'TCPConnection') AS tcp_connections,
  (SELECT value FROM system.metrics WHERE metric = 'HTTPConnection') AS http_connections,
  (SELECT value FROM system.metrics WHERE metric = 'MemoryTracking') AS memory_used,
  (SELECT value FROM system.asynchronous_metrics WHERE metric = 'OSMemoryTotal') AS memory_total,
  (SELECT value FROM system.metrics WHERE metric = 'ReadonlyReplica') AS readonly_replicas,
  (SELECT value FROM system.asynchronous_metrics WHERE metric = 'MaxPartCountForPartition') AS max_parts_per_partition,
  (SELECT value FROM system.metrics WHERE metric = 'BackgroundMergesAndMutationsPoolTask') AS background_pool_tasks
`;

// =============================================================================
// Cluster-Aware Overview Queries
// =============================================================================

// Note: Cluster-wide metrics are aggregated via time-series queries.
// For real-time metrics, we query the local node only.

// =============================================================================
// Time Series Queries for Charts (Cluster-Aware)
// =============================================================================

// Query throughput over time - cluster-aware
export const getQueriesPerMinuteQuery = (intervalMinutes: number = 60, clusterName?: string) => {
  if (clusterName) {
    return `
SELECT
  toStartOfMinute(event_time) AS timestamp,
  count() AS value
FROM clusterAllReplicas('${clusterName}', system.query_log)
WHERE
  event_time > now() - INTERVAL ${intervalMinutes} MINUTE
  AND type = 'QueryFinish'
GROUP BY timestamp
ORDER BY timestamp
SETTINGS skip_unavailable_shards = 1
`;
  }
  return `
SELECT
  toStartOfMinute(event_time) AS timestamp,
  count() AS value
FROM system.query_log
WHERE
  event_time > now() - INTERVAL ${intervalMinutes} MINUTE
  AND type = 'QueryFinish'
GROUP BY timestamp
ORDER BY timestamp
`;
};

// Inserted rows per minute - cluster-aware
export const getInsertedRowsPerMinuteQuery = (intervalMinutes: number = 60, clusterName?: string) => {
  if (clusterName) {
    return `
SELECT
  toStartOfMinute(event_time) AS timestamp,
  sum(written_rows) AS value
FROM clusterAllReplicas('${clusterName}', system.query_log)
WHERE
  event_time > now() - INTERVAL ${intervalMinutes} MINUTE
  AND type = 'QueryFinish'
GROUP BY timestamp
ORDER BY timestamp
SETTINGS skip_unavailable_shards = 1
`;
  }
  return `
SELECT
  toStartOfMinute(event_time) AS timestamp,
  sum(written_rows) AS value
FROM system.query_log
WHERE
  event_time > now() - INTERVAL ${intervalMinutes} MINUTE
  AND type = 'QueryFinish'
GROUP BY timestamp
ORDER BY timestamp
`;
};

// Selected bytes per minute - cluster-aware
export const getSelectedBytesPerMinuteQuery = (intervalMinutes: number = 60, clusterName?: string) => {
  if (clusterName) {
    return `
SELECT
  toStartOfMinute(event_time) AS timestamp,
  sum(read_bytes) AS value
FROM clusterAllReplicas('${clusterName}', system.query_log)
WHERE
  event_time > now() - INTERVAL ${intervalMinutes} MINUTE
  AND type = 'QueryFinish'
GROUP BY timestamp
ORDER BY timestamp
SETTINGS skip_unavailable_shards = 1
`;
  }
  return `
SELECT
  toStartOfMinute(event_time) AS timestamp,
  sum(read_bytes) AS value
FROM system.query_log
WHERE
  event_time > now() - INTERVAL ${intervalMinutes} MINUTE
  AND type = 'QueryFinish'
GROUP BY timestamp
ORDER BY timestamp
`;
};

// Memory usage over time - cluster-aware
export const getMemoryUsageHistoryQuery = (intervalMinutes: number = 60, clusterName?: string) => {
  if (clusterName) {
    return `
SELECT
  toStartOfMinute(event_time) AS timestamp,
  sum(memory_usage) AS value
FROM clusterAllReplicas('${clusterName}', system.query_log)
WHERE
  event_time > now() - INTERVAL ${intervalMinutes} MINUTE
  AND type = 'QueryFinish'
GROUP BY timestamp
ORDER BY timestamp
SETTINGS skip_unavailable_shards = 1
`;
  }
  return `
SELECT
  toStartOfMinute(event_time) AS timestamp,
  max(memory_usage) AS value
FROM system.query_log
WHERE
  event_time > now() - INTERVAL ${intervalMinutes} MINUTE
  AND type = 'QueryFinish'
GROUP BY timestamp
ORDER BY timestamp
`;
};


// Query duration percentiles over time - cluster-aware
export const getQueryDurationHistoryQuery = (intervalMinutes: number = 60, clusterName?: string) => {
  if (clusterName) {
    return `
SELECT
  toStartOfMinute(event_time) AS timestamp,
  avg(query_duration_ms) AS avg_duration,
  quantile(0.95)(query_duration_ms) AS p95_duration,
  quantile(0.99)(query_duration_ms) AS p99_duration
FROM clusterAllReplicas('${clusterName}', system.query_log)
WHERE
  event_time > now() - INTERVAL ${intervalMinutes} MINUTE
  AND type = 'QueryFinish'
GROUP BY timestamp
ORDER BY timestamp
SETTINGS skip_unavailable_shards = 1
`;
  }
  return `
SELECT
  toStartOfMinute(event_time) AS timestamp,
  avg(query_duration_ms) AS avg_duration,
  quantile(0.95)(query_duration_ms) AS p95_duration,
  quantile(0.99)(query_duration_ms) AS p99_duration
FROM system.query_log
WHERE
  event_time > now() - INTERVAL ${intervalMinutes} MINUTE
  AND type = 'QueryFinish'
GROUP BY timestamp
ORDER BY timestamp
`;
};

// =============================================================================
// Metrics Queries
// =============================================================================

export const METRICS_QUERY = `
SELECT
  metric,
  value,
  description,
  multiIf(
    metric LIKE '%Query%' OR metric LIKE '%Select%', 'query',
    metric LIKE '%Connection%' OR metric LIKE '%TCP%' OR metric LIKE '%HTTP%', 'connection',
    metric LIKE '%Memory%', 'memory',
    metric LIKE '%Merge%', 'merge',
    metric LIKE '%Replica%' OR metric LIKE '%ZooKeeper%' OR metric LIKE '%Keeper%', 'replication',
    metric LIKE '%Insert%' OR metric LIKE '%Write%', 'insert',
    metric LIKE '%Read%' OR metric LIKE '%IO%' OR metric LIKE '%Disk%', 'io',
    'other'
  ) AS category
FROM system.metrics
ORDER BY category, metric
`;

export const ASYNC_METRICS_QUERY = `
SELECT metric, value, description
FROM system.asynchronous_metrics
ORDER BY metric
`;

export const EVENTS_QUERY = `
SELECT event, value, description
FROM system.events
ORDER BY event
`;

// Filter metrics by category
export const getMetricsByCategoryQuery = (category: string) => `
SELECT metric, value, description, '${category}' AS category
FROM system.metrics
WHERE
  ${
    category === "query"
      ? "metric LIKE '%Query%' OR metric LIKE '%Select%'"
      : category === "connection"
        ? "metric LIKE '%Connection%' OR metric LIKE '%TCP%' OR metric LIKE '%HTTP%'"
        : category === "memory"
          ? "metric LIKE '%Memory%'"
          : category === "merge"
            ? "metric LIKE '%Merge%'"
            : category === "replication"
              ? "metric LIKE '%Replica%' OR metric LIKE '%ZooKeeper%' OR metric LIKE '%Keeper%'"
              : category === "insert"
                ? "metric LIKE '%Insert%' OR metric LIKE '%Write%'"
                : category === "io"
                  ? "metric LIKE '%Read%' OR metric LIKE '%IO%' OR metric LIKE '%Disk%'"
                  : "1=1"
  }
ORDER BY metric
`;

// =============================================================================
// Replication Queries
// =============================================================================

export const REPLICAS_QUERY = `
SELECT
  database,
  table,
  engine,
  is_leader AS isLeader,
  can_become_leader AS canBecomeLeader,
  is_readonly AS isReadonly,
  is_session_expired AS isSessionExpired,
  future_parts AS futurePartsCount,
  parts_to_check AS partsToCheckCount,
  zookeeper_path AS zookeeperPath,
  replica_name AS replicaName,
  replica_path AS replicaPath,
  columns_version AS columnsVersion,
  queue_size AS queueSize,
  inserts_in_queue AS insertsInQueue,
  merges_in_queue AS mergesInQueue,
  part_mutations_in_queue AS partMutationsInQueue,
  queue_oldest_time AS queueOldestTime,
  inserts_oldest_time AS insertsOldestTime,
  merges_oldest_time AS mergesOldestTime,
  log_max_index AS logMaxIndex,
  log_pointer AS logPointer,
  last_queue_update AS lastQueueUpdate,
  absolute_delay AS absoluteDelay,
  total_replicas AS totalReplicas,
  active_replicas AS activeReplicas
FROM system.replicas
ORDER BY database, table
`;

export const REPLICA_SUMMARY_QUERY = `
SELECT
  count() AS totalTables,
  countIf(is_leader) AS leaderCount,
  countIf(is_readonly) AS readonlyCount,
  countIf(absolute_delay > 0) AS delayedCount,
  max(absolute_delay) AS maxDelay,
  sum(queue_size) AS totalQueueSize
FROM system.replicas
`;

// =============================================================================
// Running Queries & Operations
// =============================================================================

export const RUNNING_QUERIES_QUERY = `
SELECT
  query_id,
  user,
  query,
  elapsed,
  read_rows,
  read_bytes,
  written_rows,
  written_bytes,
  memory_usage,
  peak_memory_usage,
  query_kind,
  is_initial_query,
  client_name,
  formatReadableTimeDelta(elapsed) AS elapsed_readable,
  formatReadableSize(memory_usage) AS memory_readable,
  formatReadableSize(read_bytes) AS read_bytes_readable,
  formatReadableQuantity(read_rows) AS read_rows_readable
FROM system.processes
WHERE is_cancelled = 0
ORDER BY elapsed DESC
`;

export const MERGES_QUERY = `
SELECT
  database,
  table,
  elapsed,
  progress,
  num_parts,
  source_part_names,
  result_part_name,
  total_size_bytes_compressed,
  bytes_read_uncompressed,
  bytes_written_uncompressed,
  rows_read,
  rows_written,
  memory_usage,
  merge_type,
  formatReadableSize(total_size_bytes_compressed) AS size_readable,
  formatReadableTimeDelta(elapsed) AS elapsed_readable
FROM system.merges
ORDER BY elapsed DESC
`;

export const MUTATIONS_QUERY = `
SELECT
  database,
  table,
  mutation_id AS mutationId,
  command,
  create_time AS createTime,
  is_done AS isDone,
  latest_failed_part AS latestFailedPart,
  latest_fail_time AS latestFailTime,
  latest_fail_reason AS latestFailReason,
  parts_to_do AS partsToDo,
  formatReadableTimeDelta(dateDiff('second', create_time, now())) AS elapsed_readable
FROM system.mutations
WHERE NOT is_done
ORDER BY create_time DESC
`;

// Merge summary for operations dashboard
export const MERGE_SUMMARY_QUERY = `
SELECT
  count() AS activeMerges,
  coalesce(sum(total_size_bytes_compressed), 0) AS totalBytesProcessing,
  coalesce(avg(progress), 0) AS avgProgress
FROM system.merges
`;

// Mutation summary for operations dashboard
export const MUTATION_SUMMARY_QUERY = `
SELECT
  count() AS activeMutations,
  countIf(latest_fail_reason != '') AS failedMutations,
  sum(length(parts_to_do_names)) AS totalPartsToDo
FROM system.mutations
WHERE NOT is_done
`;


// =============================================================================
// Health Check Queries
// =============================================================================

export const HEALTH_CHECKS_QUERY = `
SELECT 'Uptime' AS name,
       'Server uptime in seconds' AS description,
       toString(toUInt64(value)) AS value,
       'seconds' AS unit
FROM system.asynchronous_metrics
WHERE metric = 'Uptime'

UNION ALL

SELECT 'Active Queries' AS name,
       'Currently running queries' AS description,
       toString(value) AS value,
       '' AS unit
FROM system.metrics
WHERE metric = 'Query'

UNION ALL

SELECT 'Memory Usage' AS name,
       'Current tracked memory usage' AS description,
       formatReadableSize(value) AS value,
       '' AS unit
FROM system.metrics
WHERE metric = 'MemoryTracking'

UNION ALL

SELECT 'Readonly Replicas' AS name,
       'Number of readonly replicas' AS description,
       toString(value) AS value,
       '' AS unit
FROM system.metrics
WHERE metric = 'ReadonlyReplica'

UNION ALL

SELECT 'Parts to Check' AS name,
       'Number of parts requiring validation' AS description,
       toString(coalesce(sum(parts_to_check), 0)) AS value,
       '' AS unit
FROM system.replicas

UNION ALL

SELECT 'Replication Delay' AS name,
       'Maximum replication delay' AS description,
       toString(coalesce(max(absolute_delay), 0)) AS value,
       'seconds' AS unit
FROM system.replicas

UNION ALL

SELECT 'Max Parts Per Partition' AS name,
       'Maximum parts count in any partition' AS description,
       toString(toUInt64(value)) AS value,
       '' AS unit
FROM system.asynchronous_metrics
WHERE metric = 'MaxPartCountForPartition'
`;

// =============================================================================
// Disk & Storage Queries
// =============================================================================

export const DISKS_QUERY = `
SELECT
  name,
  path,
  free_space AS freeSpace,
  total_space AS totalSpace,
  (total_space - free_space) AS usedSpace,
  round((total_space - free_space) * 100 / total_space, 2) AS usedPercentage,
  keep_free_space AS keepFreeSpace,
  type
FROM system.disks
ORDER BY name
`;

// Disk summary for storage overview
export const DISK_SUMMARY_QUERY = `
SELECT
  count() AS totalDisks,
  sum(total_space) AS totalSpace,
  sum(total_space - free_space) AS usedSpace,
  sum(free_space) AS freeSpace,
  round(sum(total_space - free_space) * 100 / sum(total_space), 2) AS usedPercentage
FROM system.disks
`;

export const PARTS_BY_TABLE_QUERY = `
SELECT
  database,
  table,
  count() AS parts_count,
  sum(rows) AS total_rows,
  sum(bytes_on_disk) AS total_bytes,
  min(min_date) AS min_date,
  max(max_date) AS max_date
FROM system.parts
WHERE active
GROUP BY database, table
ORDER BY total_bytes DESC
LIMIT 100
`;

// =============================================================================
// ZooKeeper/Keeper Queries
// =============================================================================

// Get basic ZooKeeper metrics
export const KEEPER_METRICS_QUERY = `
SELECT
  (SELECT coalesce(value, 0) FROM system.metrics WHERE metric = 'ZooKeeperSession') AS sessions,
  (SELECT coalesce(value, 0) FROM system.metrics WHERE metric = 'ZooKeeperWatch') AS watches,
  (SELECT coalesce(value, 0) FROM system.metrics WHERE metric = 'ZooKeeperRequest') AS requests,
  (SELECT coalesce(value, 0) FROM system.metrics WHERE metric = 'ZooKeeperHardwareExceptions') AS hardware_exceptions,
  (SELECT coalesce(value, 0) FROM system.metrics WHERE metric = 'ZooKeeperSoftwareExceptions') AS software_exceptions,
  (SELECT coalesce(value, 0) FROM system.metrics WHERE metric = 'ZooKeeperUserExceptions') AS user_exceptions
`;

// Get ZooKeeper event counts
export const KEEPER_EVENTS_QUERY = `
SELECT
  (SELECT coalesce(value, 0) FROM system.events WHERE event = 'ZooKeeperInit') AS total_init,
  (SELECT coalesce(value, 0) FROM system.events WHERE event = 'ZooKeeperTransactions') AS total_transactions,
  (SELECT coalesce(value, 0) FROM system.events WHERE event = 'ZooKeeperCreate') AS total_creates,
  (SELECT coalesce(value, 0) FROM system.events WHERE event = 'ZooKeeperRemove') AS total_removes,
  (SELECT coalesce(value, 0) FROM system.events WHERE event = 'ZooKeeperExists') AS total_exists,
  (SELECT coalesce(value, 0) FROM system.events WHERE event = 'ZooKeeperGet') AS total_gets,
  (SELECT coalesce(value, 0) FROM system.events WHERE event = 'ZooKeeperSet') AS total_sets,
  (SELECT coalesce(value, 0) FROM system.events WHERE event = 'ZooKeeperList') AS total_lists,
  (SELECT coalesce(value, 0) FROM system.events WHERE event = 'ZooKeeperMulti') AS total_multi,
  (SELECT coalesce(value, 0) FROM system.events WHERE event = 'ZooKeeperWaitMicroseconds') AS wait_microseconds
`;

// Get ZooKeeper health status
export const KEEPER_HEALTH_QUERY = `
SELECT
  (SELECT coalesce(value, 0) FROM system.metrics WHERE metric = 'ZooKeeperSession') > 0 AS is_connected,
  (SELECT coalesce(value, 0) FROM system.metrics WHERE metric = 'ZooKeeperHardwareExceptions') AS hardware_exceptions,
  (SELECT coalesce(value, 0) FROM system.events WHERE event = 'ZooKeeperWaitMicroseconds') / 
    nullIf((SELECT coalesce(value, 0) FROM system.events WHERE event = 'ZooKeeperTransactions'), 0) AS avg_latency_us
`;

// =============================================================================
// Query Performance Queries
// =============================================================================

export const QUERY_PERFORMANCE_QUERY = `
SELECT
  count() / 60 AS queriesPerSecond,
  avg(query_duration_ms) AS avgDurationMs,
  quantile(0.95)(query_duration_ms) AS p95DurationMs,
  quantile(0.99)(query_duration_ms) AS p99DurationMs,
  sum(written_rows) / 60 AS insertedRowsPerSecond,
  sum(read_rows) / 60 AS selectedRowsPerSecond,
  countIf(exception_code != 0) AS failedQueriesCount
FROM system.query_log
WHERE
  event_time > now() - INTERVAL 1 MINUTE
  AND type = 'QueryFinish'
`;

// Legacy aliases for backward compatibility
export const getQueryThroughputHistoryQuery = getQueriesPerMinuteQuery;

// =============================================================================
// Cluster Nodes Queries
// =============================================================================

// Get all cluster nodes with status
export const CLUSTER_NODES_QUERY = `
SELECT
  cluster,
  shard_num,
  replica_num,
  host_name,
  host_address,
  port,
  is_local,
  coalesce(is_active, 1) AS is_active,
  errors_count,
  slowdowns_count,
  estimated_recovery_time
FROM system.clusters
ORDER BY cluster, shard_num, replica_num
`;

// Get cluster summary
export const CLUSTER_SUMMARY_QUERY = `
SELECT
  count() AS total_nodes,
  countIf(coalesce(is_active, 1) = 1) AS active_nodes,
  countIf(coalesce(is_active, 0) = 0) AS inactive_nodes,
  max(shard_num) AS total_shards,
  max(replica_num) AS max_replicas,
  sum(errors_count) AS total_errors,
  countDistinct(cluster) AS cluster_count
FROM system.clusters
`;

// Get nodes by cluster name
export const getClusterNodesQuery = (clusterName: string) => `
SELECT
  cluster,
  shard_num,
  replica_num,
  host_name,
  host_address,
  port,
  is_local,
  coalesce(is_active, 1) AS is_active,
  errors_count,
  slowdowns_count,
  estimated_recovery_time
FROM system.clusters
WHERE cluster = '${clusterName}'
ORDER BY shard_num, replica_num
`;
