import type { ClickHouseClient } from "@/lib/clickhouse";
import {
  CLUSTERS_LIST_QUERY,
  CLUSTER_SUMMARY_QUERY,
  CLUSTER_NODES_QUERY,
  OVERVIEW_QUERY,
  computeRounding,
  getDashboardQueriesPerSecQuery,
  getDashboardQueriesRunningQuery,
  getDashboardMergesRunningQuery,
  getDashboardSelectedRowsQuery,
  getDashboardInsertedRowsQuery,
  getDashboardMaxPartsQuery,
  getDashboardMemoryQuery,
  getDashboardCPUQuery,
  getDashboardCPUKernelQuery,
  getDashboardIOWaitQuery,
  getDashboardFilesystemQuery,
  getDashboardNetworkQuery,
  getDashboardNetworkSendQuery,
  getDashboardNetworkConnectionsQuery,
  getDashboardSelectedBytesQuery,
  getDashboardInsertedBytesQuery,
  getDashboardDiskReadQuery,
  getDashboardDiskWriteQuery,
  type DashboardQuery,
} from "@/lib/clickhouse/monitoring";

// Types extracted from route.ts
export interface TimeSeriesPoint {
  t: string;
  node: string;
  value: number;
}

export interface ClusterRow {
  cluster: string;
}

export interface ClusterSummaryRow {
  total_nodes: number;
  active_nodes: number;
  inactive_nodes: number;
  total_shards: number;
  max_replicas: number;
  total_errors: number;
  cluster_count: number;
}

export interface NodeRow {
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

export interface OverviewRow {
  uptime: number;
  version: string;
  active_queries: number;
  tcp_connections: number;
  http_connections: number;
  memory_used: number;
  memory_total: number;
}

export interface DashboardResponse {
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
  clickhouse: {
    queriesPerSec: TimeSeriesPoint[];
    queriesRunning: TimeSeriesPoint[];
    mergesRunning: TimeSeriesPoint[];
    selectedRowsPerSec: TimeSeriesPoint[];
    insertedRowsPerSec: TimeSeriesPoint[];
    selectedBytesPerSec: TimeSeriesPoint[];
    insertedBytesPerSec: TimeSeriesPoint[];
    maxPartsPerPartition: TimeSeriesPoint[];
  };
  systemHealth: {
    memoryTracked: TimeSeriesPoint[];
    cpuUsage: TimeSeriesPoint[];
    cpuKernel: TimeSeriesPoint[];
    ioWait: TimeSeriesPoint[];
    filesystemUsed: TimeSeriesPoint[];
    networkReceived: TimeSeriesPoint[];
    networkSent: TimeSeriesPoint[];
    networkConnections: TimeSeriesPoint[];
    diskRead: TimeSeriesPoint[];
    diskWrite: TimeSeriesPoint[];
  };
  nodes: string[];
}

export interface DashboardOptions {
  from?: string;
  to?: string;
  timeRange?: number; // minutes
}

export class MonitoringService {
  constructor(private client: ClickHouseClient) {}

  private parseTimeRange(options: DashboardOptions) {
    const { from, to, timeRange = 60 } = options;

    let fromDate: Date;
    let toDate: Date;

    if (from && to) {
      fromDate = new Date(from);
      toDate = to === "now" ? new Date() : new Date(to);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        const now = new Date();
        toDate = now;
        fromDate = new Date(now.getTime() - timeRange * 60 * 1000);
      }
    } else {
      const now = new Date();
      toDate = now;
      fromDate = new Date(now.getTime() - timeRange * 60 * 1000);
    }

    const durationMs = toDate.getTime() - fromDate.getTime();
    const rounding = computeRounding(durationMs);

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      rounding,
    };
  }

  async getDashboardData(options: DashboardOptions): Promise<DashboardResponse> {
    const { from, to, rounding } = this.parseTimeRange(options);

    // Detect cluster
    let clusterName: string | undefined;
    let clusterNodes: NodeRow[] = [];

    try {
      const clustersResult = await this.client.query<ClusterRow>(CLUSTERS_LIST_QUERY);
      const clusters = clustersResult.data
        .map((r) => r.cluster)
        .filter((c) => !c.startsWith("_") && !c.startsWith("all_groups."));

      if (clusters.length > 0) {
        clusterName = clusters.includes("default") ? "default" : clusters[0];

        const [, nodesResult] = await Promise.all([
          this.client.query<ClusterSummaryRow>(CLUSTER_SUMMARY_QUERY),
          this.client.query<NodeRow>(CLUSTER_NODES_QUERY),
        ]);

        clusterNodes = nodesResult.data.filter(
          (n) => n.cluster === clusterName,
        );
      }
    } catch {
      // Cluster detection failed, continue as single-node
    }

    // Fetch server info
    const overviewResult = await this.client.query<OverviewRow>(OVERVIEW_QUERY);
    const overview = overviewResult.data[0];

    // Helper to execute a DashboardQuery with typed query_params
    const execDashboardQuery = (dq: DashboardQuery) =>
      this.client.query<TimeSeriesPoint>(dq.query, {
        query_params: dq.query_params,
      });

    // Fetch all dashboard metrics in parallel
    const [
      queriesPerSecResult,
      queriesRunningResult,
      mergesRunningResult,
      selectedRowsResult,
      insertedRowsResult,
      selectedBytesResult,
      insertedBytesResult,
      maxPartsResult,
      memoryResult,
      cpuResult,
      cpuKernelResult,
      ioWaitResult,
      filesystemResult,
      networkResult,
      networkSendResult,
      networkConnectionsResult,
      diskReadResult,
      diskWriteResult,
    ] = await Promise.all([
      execDashboardQuery(getDashboardQueriesPerSecQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardQueriesRunningQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardMergesRunningQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardSelectedRowsQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardInsertedRowsQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardSelectedBytesQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardInsertedBytesQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardMaxPartsQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardMemoryQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardCPUQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardCPUKernelQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardIOWaitQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardFilesystemQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardNetworkQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardNetworkSendQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardNetworkConnectionsQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardDiskReadQuery(from, to, rounding, clusterName)),
      execDashboardQuery(getDashboardDiskWriteQuery(from, to, rounding, clusterName)),
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
        selectedBytesPerSec: selectedBytesResult.data,
        insertedBytesPerSec: insertedBytesResult.data,
        maxPartsPerPartition: maxPartsResult.data,
      },
      systemHealth: {
        memoryTracked: memoryResult.data,
        cpuUsage: cpuResult.data,
        cpuKernel: cpuKernelResult.data,
        ioWait: ioWaitResult.data,
        filesystemUsed: filesystemResult.data,
        networkReceived: networkResult.data,
        networkSent: networkSendResult.data,
        networkConnections: networkConnectionsResult.data,
        diskRead: diskReadResult.data,
        diskWrite: diskWriteResult.data,
      },
      nodes,
    };

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

    return dashboard;
  }
}
