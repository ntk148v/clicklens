/**
 * API route for cluster nodes topology
 * GET /api/clickhouse/monitoring/cluster
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";
import {
  CLUSTER_NODES_QUERY,
  CLUSTER_SUMMARY_QUERY,
  type MonitoringApiResponse,
} from "@/lib/clickhouse/monitoring";

interface ClusterNode {
  cluster: string;
  shardNum: number;
  replicaNum: number;
  hostName: string;
  hostAddress: string;
  port: number;
  isLocal: boolean;
  isActive: boolean;
  errorsCount: number;
  slowdownsCount: number;
  estimatedRecoveryTime: number;
}

interface ClusterSummary {
  totalNodes: number;
  activeNodes: number;
  inactiveNodes: number;
  totalShards: number;
  maxReplicas: number;
  totalErrors: number;
  clusterCount: number;
}

interface ClusterInfo {
  name: string;
  nodes: ClusterNode[];
  shards: number;
  replicas: number;
  activeNodes: number;
  totalNodes: number;
}

interface ClusterNodesResponse {
  clusters: ClusterInfo[];
  summary: ClusterSummary;
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
  estimated_recovery_time: number;
}

interface SummaryRow {
  total_nodes: number;
  active_nodes: number;
  inactive_nodes: number;
  total_shards: number;
  max_replicas: number;
  total_errors: number;
  cluster_count: number;
}

export async function GET(): Promise<
  NextResponse<MonitoringApiResponse<ClusterNodesResponse>>
> {
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

    const client = createClientWithConfig(config);

    // Fetch nodes and summary in parallel
    const [nodesResult, summaryResult] = await Promise.all([
      client.query<NodeRow>(CLUSTER_NODES_QUERY),
      client.query<SummaryRow>(CLUSTER_SUMMARY_QUERY),
    ]);

    // Transform nodes data
    const nodes: ClusterNode[] = nodesResult.data.map((row) => ({
      cluster: row.cluster,
      shardNum: row.shard_num,
      replicaNum: row.replica_num,
      hostName: row.host_name,
      hostAddress: row.host_address,
      port: row.port,
      isLocal: row.is_local === 1,
      isActive: row.is_active === 1,
      errorsCount: row.errors_count,
      slowdownsCount: row.slowdowns_count,
      estimatedRecoveryTime: row.estimated_recovery_time,
    }));

    // Group nodes by cluster
    const clusterMap = new Map<string, ClusterNode[]>();
    nodes.forEach((node) => {
      const existing = clusterMap.get(node.cluster) || [];
      existing.push(node);
      clusterMap.set(node.cluster, existing);
    });

    // Build cluster info, filtering out internal/auto-generated clusters
    // These patterns indicate internal ClickHouse cluster definitions:
    // - Clusters starting with "_" (internal)
    // - Clusters with "all_groups." prefix (aggregated view)
    const isUserCluster = (name: string): boolean => {
      if (name.startsWith("_")) return false;
      if (name.startsWith("all_groups.")) return false;
      return true;
    };

    const clusters: ClusterInfo[] = Array.from(clusterMap.entries())
      .filter(([name]) => isUserCluster(name))
      .map(([name, clusterNodes]) => ({
        name,
        nodes: clusterNodes,
        shards: Math.max(...clusterNodes.map((n) => n.shardNum), 0),
        replicas: Math.max(...clusterNodes.map((n) => n.replicaNum), 0),
        activeNodes: clusterNodes.filter((n) => n.isActive).length,
        totalNodes: clusterNodes.length,
      }));

    // Transform summary
    const summaryRow = summaryResult.data[0];
    const summary: ClusterSummary = {
      totalNodes: summaryRow?.total_nodes ?? 0,
      activeNodes: summaryRow?.active_nodes ?? 0,
      inactiveNodes: summaryRow?.inactive_nodes ?? 0,
      totalShards: summaryRow?.total_shards ?? 0,
      maxReplicas: summaryRow?.max_replicas ?? 0,
      totalErrors: summaryRow?.total_errors ?? 0,
      clusterCount: summaryRow?.cluster_count ?? 0,
    };

    return NextResponse.json({
      success: true,
      data: { clusters, summary },
    });
  } catch (error) {
    console.error("Failed to fetch cluster nodes:", error);

    if (isClickHouseError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            type: error.type,
            userMessage: "Failed to fetch cluster nodes",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 500,
          message: error instanceof Error ? error.message : "Unknown error",
          type: "CLUSTER_FETCH_ERROR",
          userMessage: "Failed to fetch cluster nodes information",
        },
      },
      { status: 500 }
    );
  }
}
