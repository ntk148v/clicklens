/**
 * API route for system metrics
 * GET /api/clickhouse/monitoring/metrics
 * Query params: ?category=query|memory|connection|...&type=metrics|async|events
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";
import {
  METRICS_QUERY,
  ASYNC_METRICS_QUERY,
  EVENTS_QUERY,
  type SystemMetric,
  type SystemAsyncMetric,
  type SystemEvent,
  type MetricsResponse,
  type MonitoringApiResponse,
} from "@/lib/clickhouse/monitoring";

export async function GET(
  request: NextRequest
): Promise<NextResponse<MonitoringApiResponse<MetricsResponse>>> {
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

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const type = searchParams.get("type"); // metrics, async, events, or all

    const client = createClientWithConfig(config);

    // Fetch based on type parameter
    const shouldFetchMetrics = !type || type === "all" || type === "metrics";
    const shouldFetchAsync = !type || type === "all" || type === "async";
    const shouldFetchEvents = !type || type === "all" || type === "events";

    const [metricsResult, asyncResult, eventsResult] = await Promise.all([
      shouldFetchMetrics ? client.query<SystemMetric>(METRICS_QUERY) : null,
      shouldFetchAsync ? client.query<SystemAsyncMetric>(ASYNC_METRICS_QUERY) : null,
      shouldFetchEvents ? client.query<SystemEvent>(EVENTS_QUERY) : null,
    ]);

    let metrics = metricsResult?.data || [];
    const asyncMetrics = asyncResult?.data || [];
    const events = eventsResult?.data || [];

    // Filter by category if provided
    if (category && metrics.length > 0) {
      metrics = metrics.filter((m) => m.category === category);
    }

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        asyncMetrics,
        events,
      },
    });
  } catch (error) {
    console.error("Monitoring metrics error:", error);

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
