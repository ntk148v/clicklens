/**
 * API route for ClickHouse Cloud-style dashboard metrics
 * GET /api/clickhouse/monitoring/dashboard
 *
 * Returns time-series data for:
 * - ClickHouse Specific: queries/sec, queries running, merges running,
 *   selected rows/sec, inserted rows/sec, max parts
 * - System Health: memory tracked, CPU, IO wait, filesystem, network
 *
 * Query params:
 *   - timeRange: number (minutes, default 60)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";
import {
  CLUSTERS_LIST_QUERY,
  CLUSTER_SUMMARY_QUERY,
  CLUSTER_NODES_QUERY,
  OVERVIEW_QUERY,
  getDashboardQueriesPerSecQuery,
  getDashboardQueriesRunningQuery,
  getDashboardMergesRunningQuery,
  getDashboardSelectedRowsQuery,
  getDashboardInsertedRowsQuery,
  getDashboardMaxPartsQuery,
  getDashboardMemoryQuery,
  getDashboardCPUQuery,
  getDashboardIOWaitQuery,
  getDashboardFilesystemQuery,
  getDashboardNetworkQuery,
  type MonitoringApiResponse,
} from "@/lib/clickhouse/monitoring";

interface TimeSeriesPoint {
  t: string;
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

interface NodeRow {
  cluster: string;
  shard_num: number;
  replica_num: number;
  host_name: string;
  host_address: string;
  port: number;
  is_local: number;
  is_active: number;
  errors_count: number;
  slowdowns_count: number;
}

interface OverviewRow {
  uptime: number;
  version: string;
  active_queries: number;
  tcp_connections: number;
  http_connections: number;
  memory_used: number;
  memory_total: number;
}

interface DashboardResponse {
  server: {
    uptime: number;
    version: string;
    hostname: string;
  };
  cluster?: {
    name: string;
    totalNodes: number;
    activeNodes: number;
    inactiveNodes: number;
    totalShards: number;
    nodes: Array<{
      hostName: string;
      hostAddress: string;
      port: number;
      shardNum: number;
      replicaNum: number;
      isLocal: boolean;
      isActive: boolean;
      errorsCount: number;
    }>;
  };
  // All time series include node field for per-node visualization
  clickhouse: {
    queriesPerSec: TimeSeriesPoint[];
    queriesRunning: TimeSeriesPoint[];
    mergesRunning: TimeSeriesPoint[];
    selectedRowsPerSec: TimeSeriesPoint[];
    insertedRowsPerSec: TimeSeriesPoint[];
    maxPartsPerPartition: TimeSeriesPoint[];
  };
  systemHealth: {
    memoryTracked: TimeSeriesPoint[];
    cpuUsage: TimeSeriesPoint[];
    ioWait: TimeSeriesPoint[];
    filesystemUsed: TimeSeriesPoint[];
    networkReceived: TimeSeriesPoint[];
  };
  nodes: string[]; // List of unique node names
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<MonitoringApiResponse<DashboardResponse>>> {
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
        { status: 401 },
      );
    }

    const client = createClient(config);
    const { searchParams } = new URL(request.url);
    const timeRange = parseInt(searchParams.get("timeRange") || "60", 10);

    // Detect cluster
    let clusterName: string | undefined;
    let clusterNodes: NodeRow[] = [];

    try {
      const clustersResult =
        await client.query<ClusterRow>(CLUSTERS_LIST_QUERY);
      const clusters = clustersResult.data
        .map((r) => r.cluster)
        .filter((c) => !c.startsWith("_") && !c.startsWith("all_groups."));

      if (clusters.length > 0) {
        // Prefer 'default' cluster if available
        clusterName = clusters.includes("default") ? "default" : clusters[0];

        const [, nodesResult] = await Promise.all([
          client.query<ClusterSummaryRow>(CLUSTER_SUMMARY_QUERY),
          client.query<NodeRow>(CLUSTER_NODES_QUERY),
        ]);

        clusterNodes = nodesResult.data.filter(
          (n) => n.cluster === clusterName,
        );
      }
    } catch {
      // Cluster detection failed, continue as single-node
    }

    // Fetch server info
    const overviewResult = await client.query<OverviewRow>(OVERVIEW_QUERY);
    const overview = overviewResult.data[0];

    // Fetch all dashboard metrics in parallel
    const [
      queriesPerSecResult,
      queriesRunningResult,
      mergesRunningResult,
      selectedRowsResult,
      insertedRowsResult,
      maxPartsResult,
      memoryResult,
      cpuResult,
      ioWaitResult,
      filesystemResult,
      networkResult,
    ] = await Promise.all([
      client.query<TimeSeriesPoint>(
        getDashboardQueriesPerSecQuery(timeRange, clusterName),
      ),
      client.query<TimeSeriesPoint>(
        getDashboardQueriesRunningQuery(timeRange, clusterName),
      ),
      client.query<TimeSeriesPoint>(
        getDashboardMergesRunningQuery(timeRange, clusterName),
      ),
      client.query<TimeSeriesPoint>(
        getDashboardSelectedRowsQuery(timeRange, clusterName),
      ),
      client.query<TimeSeriesPoint>(
        getDashboardInsertedRowsQuery(timeRange, clusterName),
      ),
      client.query<TimeSeriesPoint>(
        getDashboardMaxPartsQuery(timeRange, clusterName),
      ),
      client.query<TimeSeriesPoint>(
        getDashboardMemoryQuery(timeRange, clusterName),
      ),
      client.query<TimeSeriesPoint>(
        getDashboardCPUQuery(timeRange, clusterName),
      ),
      client.query<TimeSeriesPoint>(
        getDashboardIOWaitQuery(timeRange, clusterName),
      ),
      client.query<TimeSeriesPoint>(
        getDashboardFilesystemQuery(timeRange, clusterName),
      ),
      client.query<TimeSeriesPoint>(
        getDashboardNetworkQuery(timeRange, clusterName),
      ),
    ]);

    // Extract unique node names
    const nodeSet = new Set<string>();
    [...queriesPerSecResult.data, ...memoryResult.data].forEach((p) =>
      nodeSet.add(p.node),
    );
    const nodes = Array.from(nodeSet).sort();

    // Build response
    const dashboard: DashboardResponse = {
      server: {
        uptime: overview?.uptime || 0,
        version: overview?.version || "unknown",
        hostname: nodes[0] || "localhost",
      },
      clickhouse: {
        queriesPerSec: queriesPerSecResult.data,
        queriesRunning: queriesRunningResult.data,
        mergesRunning: mergesRunningResult.data,
        selectedRowsPerSec: selectedRowsResult.data,
        insertedRowsPerSec: insertedRowsResult.data,
        maxPartsPerPartition: maxPartsResult.data,
      },
      systemHealth: {
        memoryTracked: memoryResult.data,
        cpuUsage: cpuResult.data,
        ioWait: ioWaitResult.data,
        filesystemUsed: filesystemResult.data,
        networkReceived: networkResult.data,
      },
      nodes,
    };

    // Add cluster info if available - compute counts from filtered nodes
    if (clusterName && clusterNodes.length > 0) {
      const activeNodes = clusterNodes.filter((n) => n.is_active === 1).length;
      const totalNodes = clusterNodes.length;
      const shards = new Set(clusterNodes.map((n) => n.shard_num)).size;

      dashboard.cluster = {
        name: clusterName,
        totalNodes,
        activeNodes,
        inactiveNodes: totalNodes - activeNodes,
        totalShards: shards,
        nodes: clusterNodes.map((n) => ({
          hostName: n.host_name,
          hostAddress: n.host_address,
          port: n.port,
          shardNum: n.shard_num,
          replicaNum: n.replica_num,
          isLocal: n.is_local === 1,
          isActive: n.is_active === 1,
          errorsCount: n.errors_count,
        })),
      };
    }

    return NextResponse.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);

    if (isClickHouseError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            type: error.type,
            userMessage: error.userMessage || error.message,
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 500,
          message: error instanceof Error ? error.message : "Unknown error",
          type: "INTERNAL_ERROR",
          userMessage: "An unexpected error occurred",
        },
      },
      { status: 500 },
    );
  }
}
