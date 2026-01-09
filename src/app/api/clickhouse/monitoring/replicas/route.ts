/**
 * API route for replica status
 * GET /api/clickhouse/monitoring/replicas
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";
import {
  REPLICA_SUMMARY_QUERY,
  getReplicasQuery,
  type ReplicaStatus,
  type ReplicaSummary,
  type MonitoringApiResponse,
} from "@/lib/clickhouse/monitoring";
import { getClusterName } from "@/lib/clickhouse/cluster";

interface ReplicasResponse {
  replicas: ReplicaStatus[];
  summary: ReplicaSummary;
}

export async function GET(): Promise<
  NextResponse<MonitoringApiResponse<ReplicasResponse>>
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
    const clusterName = await getClusterName(client);

    // Fetch replicas and summary in parallel
    const [replicasResult, summaryResult] = await Promise.all([
      client.query<ReplicaStatus>(getReplicasQuery(clusterName)),
      client.query<ReplicaSummary>(REPLICA_SUMMARY_QUERY),
    ]);

    const summary = summaryResult.data[0] || {
      totalTables: 0,
      healthyTables: 0,
      readonlyTables: 0,
      tablesWithDelay: 0,
      maxDelay: 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        replicas: replicasResult.data,
        summary,
      },
    });
  } catch (error) {
    console.error("Monitoring replicas error:", error);

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
