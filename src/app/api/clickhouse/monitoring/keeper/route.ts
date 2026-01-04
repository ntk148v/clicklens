/**
 * API route for ZooKeeper/Keeper metrics
 * GET /api/clickhouse/monitoring/keeper
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";
import {
  KEEPER_METRICS_QUERY,
  type MonitoringApiResponse,
} from "@/lib/clickhouse/monitoring";

interface KeeperMetricsRow {
  sessions: number;
  watches: number;
  pending_requests: number;
  hardware_exceptions: number;
  user_exceptions: number;
  total_inits: number;
  total_transactions: number;
  total_creates: number;
  total_removes: number;
  total_gets: number;
  total_sets: number;
  total_exists: number;
  total_lists: number;
  total_multi: number;
  wait_microseconds: number;
}

interface KeeperData {
  isConnected: boolean;
  sessions: number;
  watches: number;
  pendingRequests: number;
  exceptions: {
    hardware: number;
    user: number;
  };
  operations: {
    transactions: number;
    creates: number;
    removes: number;
    gets: number;
    sets: number;
    exists: number;
    lists: number;
    multi: number;
  };
  latency: {
    totalWaitUs: number;
    avgLatencyUs: number;
  };
}

export async function GET(): Promise<NextResponse<MonitoringApiResponse<KeeperData>>> {
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
    const result = await client.query<KeeperMetricsRow>(KEEPER_METRICS_QUERY);

    const metrics = result.data[0];

    if (!metrics) {
      return NextResponse.json({
        success: true,
        data: {
          isConnected: false,
          sessions: 0,
          watches: 0,
          pendingRequests: 0,
          exceptions: { hardware: 0, user: 0 },
          operations: {
            transactions: 0,
            creates: 0,
            removes: 0,
            gets: 0,
            sets: 0,
            exists: 0,
            lists: 0,
            multi: 0,
          },
          latency: { totalWaitUs: 0, avgLatencyUs: 0 },
        },
      });
    }

    const avgLatencyUs =
      metrics.total_transactions > 0
        ? metrics.wait_microseconds / metrics.total_transactions
        : 0;

    const keeperData: KeeperData = {
      isConnected: metrics.sessions > 0,
      sessions: metrics.sessions,
      watches: metrics.watches,
      pendingRequests: metrics.pending_requests,
      exceptions: {
        hardware: metrics.hardware_exceptions,
        user: metrics.user_exceptions,
      },
      operations: {
        transactions: metrics.total_transactions,
        creates: metrics.total_creates,
        removes: metrics.total_removes,
        gets: metrics.total_gets,
        sets: metrics.total_sets,
        exists: metrics.total_exists,
        lists: metrics.total_lists,
        multi: metrics.total_multi,
      },
      latency: {
        totalWaitUs: metrics.wait_microseconds,
        avgLatencyUs: avgLatencyUs,
      },
    };

    return NextResponse.json({
      success: true,
      data: keeperData,
    });
  } catch (error) {
    console.error("Monitoring keeper error:", error);

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
