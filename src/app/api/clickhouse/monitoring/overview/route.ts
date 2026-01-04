/**
 * API route for cluster overview metrics with time-series data
 * GET /api/clickhouse/monitoring/overview
 * 
 * Supports cluster-aware queries when a cluster is detected.
 * Query params:
 *   - timeRange: number (minutes, default 60)
 *   - cluster: string (optional, auto-detects if not provided)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";
import {
  OVERVIEW_QUERY,
  QUERY_METRICS_QUERY,
  MEMORY_METRICS_QUERY,
  MERGE_METRICS_QUERY,
  THROUGHPUT_METRICS_QUERY,
  CLUSTERS_LIST_QUERY,
  CLUSTER_SUMMARY_QUERY,
  getQueriesPerMinuteQuery,
  getInsertedRowsPerMinuteQuery,
  getSelectedBytesPerMinuteQuery,
  getMemoryUsageHistoryQuery,
  getPerNodeQueriesQuery,
  getPerNodeMemoryQuery,
  getPerNodeInsertedRowsQuery,
  getPerNodeSelectedBytesQuery,
  type MonitoringApiResponse,
} from "@/lib/clickhouse/monitoring";

interface OverviewRow {
  uptime: number;
  version: string;
  active_queries: number;
  tcp_connections: number;
  http_connections: number;
  memory_used: number;
  memory_total: number;
  readonly_replicas: number;
  max_parts_per_partition: number;
  background_pool_tasks: number;
}

interface QueryMetricsRow {
  running_queries: number;
  query_threads: number;
  preempted_queries: number;
  total_queries: number;
  failed_queries: number;
  select_queries: number;
  insert_queries: number;
}

interface MemoryMetricsRow {
  memory_used: number;
  memory_total: number;
  merge_memory: number;
  memory_resident: number;
  memory_shared: number;
}

interface MergeMetricsRow {
  running_merges: number;
  running_mutations: number;
  background_pool_tasks: number;
  max_parts_per_partition: number;
  merged_rows: number;
  merged_bytes: number;
}

interface ThroughputMetricsRow {
  inserted_rows: number;
  inserted_bytes: number;
  selected_rows: number;
  selected_bytes: number;
}

interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

interface PerNodeTimeSeriesPoint {
  timestamp: string;
  node: string;
  value: number;
}

interface ClusterRow {
  cluster: string;
}

interface ClusterSummaryRow {
  total_nodes: number;
  active_nodes: number;
  inactive_nodes: number;
  total_shards: number;
  max_replicas: number;
  total_errors: number;
  cluster_count: number;
}

interface DashboardOverview {
  server: {
    uptime: number;
    version: string;
    tcpConnections: number;
    httpConnections: number;
  };
  queries: {
    running: number;
    threads: number;
    total: number;
    failed: number;
    selects: number;
    inserts: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    mergeMemory: number;
  };
  merges: {
    running: number;
    mutations: number;
    backgroundTasks: number;
    maxPartsPerPartition: number;
    mergedRows: number;
  };
  throughput: {
    insertedRows: number;
    insertedBytes: number;
    selectedRows: number;
    selectedBytes: number;
  };
  timeSeries: {
    queriesPerMinute: TimeSeriesPoint[];
    insertedRowsPerMinute: TimeSeriesPoint[];
    selectedBytesPerMinute: TimeSeriesPoint[];
    memoryUsage: TimeSeriesPoint[];
  };
  perNodeTimeSeries?: {
    queries: PerNodeTimeSeriesPoint[];
    memory: PerNodeTimeSeriesPoint[];
    insertedRows: PerNodeTimeSeriesPoint[];
    selectedBytes: PerNodeTimeSeriesPoint[];
    nodes: string[]; // List of unique node names
  };
  cluster?: {
    name: string;
    totalNodes: number;
    activeNodes: number;
    inactiveNodes: number;
    totalShards: number;
    maxReplicas: number;
    totalErrors: number;
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<MonitoringApiResponse<DashboardOverview>>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 401,
            message: "Not authenticated",
            type: "AUTH_REQUIRED",
            userMessage: "Please log in to ClickHouse first",
          },
        },
        { status: 401 }
      );
    }

    // Get params
    const searchParams = request.nextUrl.searchParams;
    const timeRange = parseInt(searchParams.get("timeRange") || "60", 10);
    let clusterName = searchParams.get("cluster") || undefined;

    const client = createClientWithConfig(config);

    // Auto-detect cluster if not specified
    if (!clusterName) {
      try {
        const clustersResult = await client.query<ClusterRow>(CLUSTERS_LIST_QUERY);
        if (clustersResult.data.length > 0) {
          // Use 'default' cluster if available, otherwise use first one
          const defaultCluster = clustersResult.data.find(c => c.cluster === 'default');
          clusterName = defaultCluster?.cluster || clustersResult.data[0].cluster;
        }
      } catch {
        // Ignore cluster detection errors, proceed with single-node mode
        clusterName = undefined;
      }
    }

    // Fetch cluster summary if we have a cluster
    let clusterSummary: ClusterSummaryRow | null = null;
    if (clusterName) {
      try {
        const summaryResult = await client.query<ClusterSummaryRow>(CLUSTER_SUMMARY_QUERY);
        clusterSummary = summaryResult.data[0] || null;
      } catch {
        // Ignore cluster summary errors
      }
    }

    // Fetch all metrics in parallel (use cluster-aware queries if cluster is available)
    const [
      overviewResult,
      queryMetricsResult,
      memoryMetricsResult,
      mergeMetricsResult,
      throughputResult,
      queriesHistoryResult,
      insertedHistoryResult,
      selectedHistoryResult,
      memoryHistoryResult,
    ] = await Promise.all([
      // Always use local node for real-time metrics (time-series are cluster-aware)
      client.query<OverviewRow>(OVERVIEW_QUERY),
      client.query<QueryMetricsRow>(QUERY_METRICS_QUERY),
      client.query<MemoryMetricsRow>(MEMORY_METRICS_QUERY),
      client.query<MergeMetricsRow>(MERGE_METRICS_QUERY),
      client.query<ThroughputMetricsRow>(THROUGHPUT_METRICS_QUERY),
      // Time series queries with cluster awareness
      client.query<TimeSeriesPoint>(getQueriesPerMinuteQuery(timeRange, clusterName)),
      client.query<TimeSeriesPoint>(getInsertedRowsPerMinuteQuery(timeRange, clusterName)),
      client.query<TimeSeriesPoint>(getSelectedBytesPerMinuteQuery(timeRange, clusterName)),
      client.query<TimeSeriesPoint>(getMemoryUsageHistoryQuery(timeRange, clusterName)),
    ]);

    const overview = overviewResult.data[0];
    const queryMetrics = queryMetricsResult.data[0];
    const memoryMetrics = memoryMetricsResult.data[0];
    const mergeMetrics = mergeMetricsResult.data[0];
    const throughput = throughputResult.data[0];

    const memoryPercentage =
      memoryMetrics?.memory_total > 0
        ? Math.round(
            (memoryMetrics.memory_used / memoryMetrics.memory_total) * 100
          )
        : 0;

    const dashboard: DashboardOverview = {
      server: {
        uptime: overview?.uptime || 0,
        version: overview?.version || "unknown",
        tcpConnections: overview?.tcp_connections || 0,
        httpConnections: overview?.http_connections || 0,
      },
      queries: {
        running: queryMetrics?.running_queries || 0,
        threads: queryMetrics?.query_threads || 0,
        total: queryMetrics?.total_queries || 0,
        failed: queryMetrics?.failed_queries || 0,
        selects: queryMetrics?.select_queries || 0,
        inserts: queryMetrics?.insert_queries || 0,
      },
      memory: {
        used: memoryMetrics?.memory_used || 0,
        total: memoryMetrics?.memory_total || 0,
        percentage: memoryPercentage,
        mergeMemory: memoryMetrics?.merge_memory || 0,
      },
      merges: {
        running: mergeMetrics?.running_merges || 0,
        mutations: mergeMetrics?.running_mutations || 0,
        backgroundTasks: mergeMetrics?.background_pool_tasks || 0,
        maxPartsPerPartition: mergeMetrics?.max_parts_per_partition || 0,
        mergedRows: mergeMetrics?.merged_rows || 0,
      },
      throughput: {
        insertedRows: throughput?.inserted_rows || 0,
        insertedBytes: throughput?.inserted_bytes || 0,
        selectedRows: throughput?.selected_rows || 0,
        selectedBytes: throughput?.selected_bytes || 0,
      },
      timeSeries: {
        queriesPerMinute: queriesHistoryResult.data,
        insertedRowsPerMinute: insertedHistoryResult.data,
        selectedBytesPerMinute: selectedHistoryResult.data,
        memoryUsage: memoryHistoryResult.data,
      },
    };

    // Add cluster info if available
    if (clusterName && clusterSummary) {
      dashboard.cluster = {
        name: clusterName,
        totalNodes: clusterSummary.total_nodes,
        activeNodes: clusterSummary.active_nodes,
        inactiveNodes: clusterSummary.inactive_nodes,
        totalShards: clusterSummary.total_shards,
        maxReplicas: clusterSummary.max_replicas,
        totalErrors: clusterSummary.total_errors,
      };

      // Fetch per-node time series data for multi-line charts
      try {
        const [
          perNodeQueriesResult,
          perNodeMemoryResult,
          perNodeInsertedResult,
          perNodeSelectedResult,
        ] = await Promise.all([
          client.query<PerNodeTimeSeriesPoint>(getPerNodeQueriesQuery(timeRange, clusterName)),
          client.query<PerNodeTimeSeriesPoint>(getPerNodeMemoryQuery(timeRange, clusterName)),
          client.query<PerNodeTimeSeriesPoint>(getPerNodeInsertedRowsQuery(timeRange, clusterName)),
          client.query<PerNodeTimeSeriesPoint>(getPerNodeSelectedBytesQuery(timeRange, clusterName)),
        ]);

        // Extract unique node names from all per-node data
        const nodeSet = new Set<string>();
        perNodeQueriesResult.data.forEach(p => nodeSet.add(p.node));
        perNodeMemoryResult.data.forEach(p => nodeSet.add(p.node));

        dashboard.perNodeTimeSeries = {
          queries: perNodeQueriesResult.data,
          memory: perNodeMemoryResult.data,
          insertedRows: perNodeInsertedResult.data,
          selectedBytes: perNodeSelectedResult.data,
          nodes: Array.from(nodeSet).sort(),
        };
      } catch {
        // Per-node data is optional, ignore errors
      }
    }

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("Monitoring overview error:", error);

    if (isClickHouseError(error)) {
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          type: error.type,
          userMessage: error.userMessage || error.message,
        },
      });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 500,
        message: error instanceof Error ? error.message : "Unknown error",
        type: "INTERNAL_ERROR",
        userMessage: "An unexpected error occurred",
      },
    });
  }
}
