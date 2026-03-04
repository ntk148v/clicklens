import type { ClickHouseClient } from "@/lib/clickhouse";
import { getClusterName } from "@/lib/clickhouse/cluster";
import {
  CLUSTER_SUMMARY_QUERY,
  CLUSTER_NODES_QUERY,
  OVERVIEW_QUERY,
  computeRounding,
} from "@/lib/clickhouse/monitoring";
import {
  getDashboardMetricLogBatchQuery,
  getDashboardAsyncMetricLogBatchQuery,
  type MetricLogBatchRow,
  type AsyncMetricLogBatchRow,
} from "@/lib/clickhouse/monitoring/batched";

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

    // Fetch server info + batched metrics in parallel (3 queries instead of 19)
    const metricLogDq = getDashboardMetricLogBatchQuery(
      from,
      to,
      rounding,
      clusterName,
    );
    const asyncMetricLogDq = getDashboardAsyncMetricLogBatchQuery(
      from,
      to,
      rounding,
      clusterName,
    );

    const [overviewResult, metricLogResult, asyncMetricLogResult] =
      await Promise.all([
        this.client.query<OverviewRow>(OVERVIEW_QUERY),
        this.client.query<MetricLogBatchRow>(metricLogDq.query, {
          query_params: metricLogDq.query_params,
        }),
        this.client.query<AsyncMetricLogBatchRow>(asyncMetricLogDq.query, {
          query_params: asyncMetricLogDq.query_params,
        }),
      ]);

    const overview = overviewResult.data[0];

    // --- Parse metric_log batch into individual TimeSeriesPoint[] arrays ---
    const queriesPerSec: TimeSeriesPoint[] = [];
    const queriesRunning: TimeSeriesPoint[] = [];
    const mergesRunning: TimeSeriesPoint[] = [];
    const selectedRows: TimeSeriesPoint[] = [];
    const insertedRows: TimeSeriesPoint[] = [];
    const selectedBytes: TimeSeriesPoint[] = [];
    const insertedBytes: TimeSeriesPoint[] = [];
    const memoryTracked: TimeSeriesPoint[] = [];
    const ioWait: TimeSeriesPoint[] = [];
    const networkConnections: TimeSeriesPoint[] = [];
    const diskRead: TimeSeriesPoint[] = [];
    const diskWrite: TimeSeriesPoint[] = [];

    for (const row of metricLogResult.data) {
      const base = { t: row.t, node: row.node };
      queriesPerSec.push({ ...base, value: Number(row.queries_per_sec) });
      queriesRunning.push({ ...base, value: Number(row.queries_running) });
      mergesRunning.push({ ...base, value: Number(row.merges_running) });
      selectedRows.push({ ...base, value: Number(row.selected_rows) });
      insertedRows.push({ ...base, value: Number(row.inserted_rows) });
      selectedBytes.push({ ...base, value: Number(row.selected_bytes) });
      insertedBytes.push({ ...base, value: Number(row.inserted_bytes) });
      memoryTracked.push({ ...base, value: Number(row.memory_tracking) });
      ioWait.push({ ...base, value: Number(row.io_wait) });
      networkConnections.push({
        ...base,
        value: Number(row.network_connections),
      });
      diskRead.push({ ...base, value: Number(row.disk_read) });
      diskWrite.push({ ...base, value: Number(row.disk_write) });
    }

    // --- Parse async_metric_log batch into individual TimeSeriesPoint[] arrays ---
    const maxParts: TimeSeriesPoint[] = [];
    const cpuUsage: TimeSeriesPoint[] = [];
    const cpuKernel: TimeSeriesPoint[] = [];
    const filesystemUsed: TimeSeriesPoint[] = [];
    const networkReceived: TimeSeriesPoint[] = [];
    const networkSent: TimeSeriesPoint[] = [];

    for (const row of asyncMetricLogResult.data) {
      const point: TimeSeriesPoint = {
        t: row.t,
        node: row.node,
        value: Number(row.value),
      };
      switch (row.metric_name) {
        case "max_parts":
          maxParts.push(point);
          break;
        case "cpu_user":
          cpuUsage.push(point);
          break;
        case "cpu_kernel":
          cpuKernel.push(point);
          break;
        case "filesystem":
          filesystemUsed.push(point);
          break;
        case "network_recv":
          networkReceived.push(point);
          break;
        case "network_send":
          networkSent.push(point);
          break;
      }
    }

    // Extract unique node names
    const nodeSet = new Set<string>();
    [...queriesPerSec, ...memoryTracked].forEach((p) => nodeSet.add(p.node));
    const nodes = Array.from(nodeSet).sort();

    // Build response
    const dashboard: DashboardResponse = {
      server: {
        uptime: overview?.uptime || 0,
        version: overview?.version || "unknown",
        hostname: nodes[0] || "localhost",
      },
      clickhouse: {
        queriesPerSec,
        queriesRunning,
        mergesRunning,
        selectedRowsPerSec: selectedRows,
        insertedRowsPerSec: insertedRows,
        selectedBytesPerSec: selectedBytes,
        insertedBytesPerSec: insertedBytes,
        maxPartsPerPartition: maxParts,
      },
      systemHealth: {
        memoryTracked,
        cpuUsage,
        cpuKernel,
        ioWait,
        filesystemUsed,
        networkReceived,
        networkSent,
        networkConnections,
        diskRead,
        diskWrite,
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
