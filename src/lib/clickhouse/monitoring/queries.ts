/**
 * ClickHouse Monitoring SQL Queries
 * Pre-built queries for fetching monitoring data from system tables
 */

// =============================================================================
// Overview Queries
// =============================================================================

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
  toString(queue_oldest_time) AS queueOldestTime,
  toString(inserts_oldest_time) AS insertsOldestTime,
  toString(merges_oldest_time) AS mergesOldestTime,
  log_max_index AS logMaxIndex,
  log_pointer AS logPointer,
  toString(last_queue_update) AS lastQueueUpdate,
  absolute_delay AS absoluteDelay,
  total_replicas AS totalReplicas,
  active_replicas AS activeReplicas
FROM system.replicas
ORDER BY database, table
`;

export const REPLICA_SUMMARY_QUERY = `
SELECT
  count() AS totalTables,
  countIf(NOT is_readonly AND absolute_delay < 10) AS healthyTables,
  countIf(is_readonly) AS readonlyTables,
  countIf(absolute_delay >= 10) AS tablesWithDelay,
  max(absolute_delay) AS maxDelay
FROM system.replicas
`;

// =============================================================================
// Operations Queries (Merges & Mutations)
// =============================================================================

export const MERGES_QUERY = `
SELECT
  database,
  table,
  elapsed,
  progress,
  num_parts AS numParts,
  source_part_names AS sourcePartNames,
  result_part_name AS resultPartName,
  source_part_paths AS sourcePartPaths,
  result_part_path AS resultPartPath,
  partition_id AS partitionId,
  is_mutation AS isMutation,
  total_size_bytes_compressed AS totalSizeBytesCompressed,
  bytes_read_uncompressed AS bytesReadUncompressed,
  rows_read AS rowsRead,
  bytes_written_uncompressed AS bytesWrittenUncompressed,
  rows_written AS rowsWritten,
  memory_usage AS memoryUsage,
  thread_id AS threadId,
  merge_type AS mergeType,
  merge_algorithm AS mergeAlgorithm
FROM system.merges
ORDER BY elapsed DESC
`;

export const MUTATIONS_QUERY = `
SELECT
  database,
  table,
  mutation_id AS mutationId,
  command,
  toString(create_time) AS createTime,
  parts_to_do_names AS partsToDo,
  is_done AS isDone,
  latest_failed_part AS latestFailedPart,
  toString(latest_fail_time) AS latestFailTime,
  latest_fail_reason AS latestFailReason
FROM system.mutations
WHERE NOT is_done
ORDER BY create_time DESC
`;

export const MERGE_SUMMARY_QUERY = `
SELECT
  count() AS activeMerges,
  sum(total_size_bytes_compressed) AS totalBytesProcessing,
  avg(progress) AS avgProgress
FROM system.merges
`;

export const MUTATION_SUMMARY_QUERY = `
SELECT
  countIf(NOT is_done) AS activeMutations,
  countIf(latest_fail_reason != '') AS failedMutations,
  sum(length(parts_to_do_names)) AS totalPartsToDo
FROM system.mutations
WHERE NOT is_done
`;

// =============================================================================
// Health Check Queries
// Note: All values are cast to Float64 to ensure consistent types in UNION ALL
// =============================================================================

export const HEALTH_CHECKS_QUERY = `
SELECT
  'server_responsive' AS id,
  'Server Responsive' AS name,
  'ClickHouse server is responding to queries' AS description,
  toFloat64(1) AS value,
  '' AS message

UNION ALL

SELECT
  'readonly_replicas' AS id,
  'Readonly Replicas' AS name,
  'Number of replicas in readonly mode' AS description,
  toFloat64(coalesce((SELECT value FROM system.metrics WHERE metric = 'ReadonlyReplica'), 0)) AS value,
  '' AS message

UNION ALL

SELECT
  'max_parts_per_partition' AS id,
  'Max Parts per Partition' AS name,
  'Maximum number of parts in any partition (should be < 300)' AS description,
  toFloat64(coalesce((SELECT value FROM system.asynchronous_metrics WHERE metric = 'MaxPartCountForPartition'), 0)) AS value,
  '' AS message

UNION ALL

SELECT
  'delayed_inserts' AS id,
  'Delayed Inserts' AS name,
  'Number of INSERT queries waiting due to high parts count' AS description,
  toFloat64(coalesce((SELECT value FROM system.metrics WHERE metric = 'DelayedInserts'), 0)) AS value,
  '' AS message

UNION ALL

SELECT
  'rejected_inserts' AS id,
  'Rejected Inserts' AS name,
  'Number of INSERT queries rejected due to too many parts' AS description,
  toFloat64(coalesce((SELECT value FROM system.events WHERE event = 'RejectedInserts'), 0)) AS value,
  '' AS message

UNION ALL

SELECT
  'zookeeper_exceptions' AS id,
  'ZooKeeper Exceptions' AS name,
  'Number of ZooKeeper hardware exceptions' AS description,
  toFloat64(coalesce((SELECT value FROM system.events WHERE event = 'ZooKeeperHardwareExceptions'), 0)) AS value,
  '' AS message

UNION ALL

SELECT
  'distributed_files_to_insert' AS id,
  'Distributed Queue' AS name,
  'Files pending in distributed send queue' AS description,
  toFloat64(coalesce((SELECT value FROM system.metrics WHERE metric = 'DistributedFilesToInsert'), 0)) AS value,
  '' AS message

UNION ALL

SELECT
  'replicated_data_loss' AS id,
  'Replicated Data Loss' AS name,
  'Data loss events in replicated tables' AS description,
  toFloat64(coalesce((SELECT value FROM system.events WHERE event = 'ReplicatedDataLoss'), 0)) AS value,
  '' AS message
`;

// =============================================================================
// Disk Queries
// =============================================================================

export const DISKS_QUERY = `
SELECT
  name,
  path,
  free_space AS freeSpace,
  total_space AS totalSpace,
  (total_space - free_space) AS usedSpace,
  round((total_space - free_space) * 100.0 / nullIf(total_space, 0), 2) AS usedPercentage,
  keep_free_space AS keepFreeSpace,
  type
FROM system.disks
ORDER BY name
`;

export const DISK_SUMMARY_QUERY = `
SELECT
  count() AS totalDisks,
  sum(total_space) AS totalSpace,
  sum(total_space - free_space) AS totalUsed,
  sum(free_space) AS totalFree,
  round(sum(total_space - free_space) * 100.0 / nullIf(sum(total_space), 0), 2) AS overallUsedPercentage
FROM system.disks
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

// Time series query for charts
export const getQueryThroughputHistoryQuery = (intervalMinutes: number = 60) => `
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

export const getMemoryUsageHistoryQuery = (intervalMinutes: number = 60) => `
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
