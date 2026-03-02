import type { ClickHouseClient } from "@/lib/clickhouse";
import { getClusterName } from "@/lib/clickhouse/cluster";
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
  minTime?: string; // For incremental updates: fetch only data newer than this
}

export class MonitoringService {
  constructor(private client: ClickHouseClient) {}

  private parseTimeRange(options: DashboardOptions) {
    const { from, to, timeRange = 60, minTime } = options;

    let fromDate: Date;
    let toDate: Date;

    // 1. Determine the "Global Window" to calculate proper rounding
    // We need the rounding to be consistent regardless of whether we are fetching 1 hour or 1 minute
    let windowDurationMs: number;

    if (from && to) {
      const f = new Date(from);
      const t = to === "now" ? new Date() : new Date(to);
      windowDurationMs = t.getTime() - f.getTime();
    } else {
      windowDurationMs = timeRange * 60 * 1000;
    }

    const rounding = computeRounding(windowDurationMs);

    // 2. Determine the "Fetch Window" (what we actually query)
    if (minTime) {
      // Incremental mode: Fetch from minTime to Now
      fromDate = new Date(minTime);
      toDate = new Date();
    } else if (from && to) {
      // Absolute mode
      fromDate = new Date(from);
      toDate = to === "now" ? new Date() : new Date(to);
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        const now = new Date();
        toDate = now;
        fromDate = new Date(now.getTime() - timeRange * 60 * 1000);
      }
    } else {
      // Relative mode (default)
      const now = new Date();
      toDate = now;
      fromDate = new Date(now.getTime() - timeRange * 60 * 1000);
    }

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      rounding,
    };
  }

  /**
   * Helper to merge new incremental data into existing dashboard data
   */
  static mergeDashboardData(
    current: DashboardResponse,
    incoming: DashboardResponse,
  ): DashboardResponse {
    // Helper to merge a specific time series array
    const mergeSeries = (
      curr: TimeSeriesPoint[],
      inc: TimeSeriesPoint[],
    ): TimeSeriesPoint[] => {
      if (!inc || inc.length === 0) return curr;

      // Create a map of existing points for O(1) lookup
      // Key: timestamp + node
      const map = new Map<string, TimeSeriesPoint>();
      curr.forEach((p) => map.set(`${p.t}-${p.node}`, p));

      // Add/Update with incoming points
      inc.forEach((p) => map.set(`${p.t}-${p.node}`, p));

      // Convert back to array and sort
      return Array.from(map.values()).sort(
        (a, b) => new Date(a.t).getTime() - new Date(b.t).getTime(),
      );
    };

    return {
      ...incoming, // Take latest server info, cluster info, etc.
      clickhouse: {
        queriesPerSec: mergeSeries(
          current.clickhouse.queriesPerSec,
          incoming.clickhouse.queriesPerSec,
        ),
        queriesRunning: mergeSeries(
          current.clickhouse.queriesRunning,
          incoming.clickhouse.queriesRunning,
        ),
        mergesRunning: mergeSeries(
          current.clickhouse.mergesRunning,
          incoming.clickhouse.mergesRunning,
        ),
        selectedRowsPerSec: mergeSeries(
          current.clickhouse.selectedRowsPerSec,
          incoming.clickhouse.selectedRowsPerSec,
        ),
        insertedRowsPerSec: mergeSeries(
          current.clickhouse.insertedRowsPerSec,
          incoming.clickhouse.insertedRowsPerSec,
        ),
        selectedBytesPerSec: mergeSeries(
          current.clickhouse.selectedBytesPerSec,
          incoming.clickhouse.selectedBytesPerSec,
        ),
        insertedBytesPerSec: mergeSeries(
          current.clickhouse.insertedBytesPerSec,
          incoming.clickhouse.insertedBytesPerSec,
        ),
        maxPartsPerPartition: mergeSeries(
          current.clickhouse.maxPartsPerPartition,
          incoming.clickhouse.maxPartsPerPartition,
        ),
      },
      systemHealth: {
        memoryTracked: mergeSeries(
          current.systemHealth.memoryTracked,
          incoming.systemHealth.memoryTracked,
        ),
        cpuUsage: mergeSeries(
          current.systemHealth.cpuUsage,
          incoming.systemHealth.cpuUsage,
        ),
        cpuKernel: mergeSeries(
          current.systemHealth.cpuKernel,
          incoming.systemHealth.cpuKernel,
        ),
        ioWait: mergeSeries(
          current.systemHealth.ioWait,
          incoming.systemHealth.ioWait,
        ),
        filesystemUsed: mergeSeries(
          current.systemHealth.filesystemUsed,
          incoming.systemHealth.filesystemUsed,
        ),
        networkReceived: mergeSeries(
          current.systemHealth.networkReceived,
          incoming.systemHealth.networkReceived,
        ),
        networkSent: mergeSeries(
          current.systemHealth.networkSent,
          incoming.systemHealth.networkSent,
        ),
        networkConnections: mergeSeries(
          current.systemHealth.networkConnections,
          incoming.systemHealth.networkConnections,
        ),
        diskRead: mergeSeries(
          current.systemHealth.diskRead,
          incoming.systemHealth.diskRead,
        ),
        diskWrite: mergeSeries(
          current.systemHealth.diskWrite,
          incoming.systemHealth.diskWrite,
        ),
      },
    };
  }

  async getDashboardData(
    options: DashboardOptions,
  ): Promise<DashboardResponse> {
    const { from, to, rounding } = this.parseTimeRange(options);

    // Detect cluster
    let clusterName: string | undefined;
    let clusterNodes: NodeRow[] = [];

    try {
      const detectedCluster = await getClusterName(this.client);

      if (detectedCluster) {
        clusterName = detectedCluster;

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
      execDashboardQuery(
        getDashboardQueriesPerSecQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardQueriesRunningQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardMergesRunningQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardSelectedRowsQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardInsertedRowsQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardSelectedBytesQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardInsertedBytesQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardMaxPartsQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardMemoryQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(getDashboardCPUQuery(from, to, rounding, clusterName)),
      execDashboardQuery(
        getDashboardCPUKernelQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardIOWaitQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardFilesystemQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardNetworkQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardNetworkSendQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardNetworkConnectionsQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardDiskReadQuery(from, to, rounding, clusterName),
      ),
      execDashboardQuery(
        getDashboardDiskWriteQuery(from, to, rounding, clusterName),
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
