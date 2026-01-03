/**
 * API route for cluster overview metrics
 * GET /api/clickhouse/monitoring/overview
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";
import { OVERVIEW_QUERY, type ClusterOverview, type MonitoringApiResponse } from "@/lib/clickhouse/monitoring";

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

export async function GET(): Promise<NextResponse<MonitoringApiResponse<ClusterOverview>>> {
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
    const result = await client.query<OverviewRow>(OVERVIEW_QUERY);

    if (result.data.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 500,
          message: "No data returned",
          type: "NO_DATA",
          userMessage: "Could not fetch cluster overview",
        },
      });
    }

    const row = result.data[0];
    const memoryPercentage = row.memory_total > 0 
      ? Math.round((row.memory_used / row.memory_total) * 100) 
      : 0;

    const overview: ClusterOverview = {
      uptime: row.uptime,
      version: row.version,
      activeQueries: row.active_queries,
      connections: {
        tcp: row.tcp_connections,
        http: row.http_connections,
        total: row.tcp_connections + row.http_connections,
      },
      memory: {
        used: row.memory_used,
        total: row.memory_total,
        percentage: memoryPercentage,
      },
      readonlyReplicas: row.readonly_replicas,
      maxPartsPerPartition: row.max_parts_per_partition,
      backgroundPoolTasks: row.background_pool_tasks,
    };

    return NextResponse.json({
      success: true,
      data: overview,
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
