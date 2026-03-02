import { describe, it, expect, mock, beforeEach } from "bun:test";
import { MonitoringService } from "./monitoring";
import type { ClickHouseClient } from "@/lib/clickhouse";

// Mock data
const mockOverview = [
  {
    uptime: 100,
    version: "23.8.1",
    active_queries: 10,
    tcp_connections: 50,
    http_connections: 20,
    memory_used: 1024,
    memory_total: 2048,
  },
];

const mockTimeSeries = [
  { t: "2023-01-01T00:00:00Z", node: "node1", value: 100 },
];

const mockClusters = [{ cluster: "default" }];
const mockClusterSummary = [
  {
    total_nodes: 1,
    active_nodes: 1,
    inactive_nodes: 0,
    total_shards: 1,
    max_replicas: 1,
    total_errors: 0,
    cluster_count: 1,
  },
];
const mockClusterNodes = [
  {
    cluster: "default",
    shard_num: 1,
    replica_num: 1,
    host_name: "node1",
    host_address: "127.0.0.1",
    port: 9000,
    is_local: 1,
    is_active: 1,
    errors_count: 0,
    slowdowns_count: 0,
  },
];

describe("MonitoringService", () => {
  let mockClient: Partial<ClickHouseClient>;
  let service: MonitoringService;

  beforeEach(() => {
    mockClient = {
      query: mock((query: string) => {
        if (query.includes("system.clusters")) {
          return Promise.resolve({ data: mockClusters });
        }
        if (query.includes("system.metrics")) {
          // Overview query approximation
          if (query.includes("uptime"))
            return Promise.resolve({ data: mockOverview });
        }
        // Simplify: return time series for all other queries
        return Promise.resolve({ data: mockTimeSeries });
      }),
    };
    service = new MonitoringService(mockClient as ClickHouseClient);
  });

  it("should fetch dashboard data successfully", async () => {
    // Override the mock to handle the Promise.all calls more specifically if needed
    // For now, let's assume the simple mock works for the structure check

    // We need to be more specific with the mock because the service calls query multiple times
    // and expects different data structures.

    mockClient.query = mock((query: string) => {
      if (query.includes("SELECT cluster FROM system.clusters"))
        return Promise.resolve({ data: mockClusters });
      if (query.includes("count() AS total_nodes"))
        return Promise.resolve({ data: mockClusterSummary });
      if (query.includes("SELECT\n  cluster,\n  shard_num"))
        return Promise.resolve({ data: mockClusterNodes });
      if (query.includes("(SELECT version()) AS version"))
        return Promise.resolve({ data: mockOverview });

      // Default time series data
      return Promise.resolve({ data: mockTimeSeries });
    });

    const result = await service.getDashboardData({ timeRange: 60 });

    expect(result).toBeDefined();
    expect(result.server.version).toBe("23.8.1");
    expect(result.cluster).toBeDefined();
    expect(result.cluster?.name).toBe("default");
    expect(result.clickhouse.queriesPerSec).toHaveLength(1);
    expect(result.systemHealth.cpuUsage).toHaveLength(1);
    expect(result.nodes).toContain("node1");
  });
});
