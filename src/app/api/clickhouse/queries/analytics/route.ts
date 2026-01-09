/**
 * API route for query analytics - expensive queries analysis
 * GET /api/clickhouse/queries/analytics?metric=duration&limit=50
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClient,
  getLensConfig,
  isLensUserConfigured,
  isClickHouseError,
} from "@/lib/clickhouse";

export interface ExpensiveQuery {
  query: string;
  normalized_query_hash: string;
  user: string;
  query_kind: string;
  count: number;
  total_duration_ms: number;
  avg_duration_ms: number;
  max_duration_ms: number;
  total_memory: number;
  avg_memory: number;
  max_memory: number;
  total_read_bytes: number;
  avg_read_bytes: number;
  last_event_time: string;
}

interface AnalyticsResponse {
  success: boolean;
  data?: {
    queries: ExpensiveQuery[];
    summary: {
      total_queries: number;
      total_duration_ms: number;
      total_memory: number;
      total_read_bytes: number;
      failed_queries: number;
    };
  };
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<AnalyticsResponse>> {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 401,
            message: "Not authenticated",
            type: "AUTH_REQUIRED",
            userMessage: "Please log in first",
          },
        },
        { status: 401 }
      );
    }

    if (!isLensUserConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 500,
            message: "Lens user not configured",
            type: "CONFIG_ERROR",
            userMessage: "Server not properly configured",
          },
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const metric = searchParams.get("metric") || "duration"; // duration, memory, read_bytes
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const lensConfig = getLensConfig();
    if (!lensConfig) {
      return NextResponse.json({
        success: false,
        error: {
          code: 500,
          message: "Lens config not available",
          type: "CONFIG_ERROR",
          userMessage: "Server not properly configured",
        },
      });
    }

    const client = createClient(lensConfig);

    // Determine sort order based on metric
    let orderBy = "total_duration_ms DESC";
    if (metric === "memory") {
      orderBy = "total_memory DESC";
    } else if (metric === "read_bytes") {
      orderBy = "total_read_bytes DESC";
    }

    // Get aggregated expensive queries grouped by normalized_query_hash
    const result = await client.query<ExpensiveQuery>(`
      SELECT
        any(query) as query,
        toString(normalized_query_hash) as normalized_query_hash,
        any(user) as user,
        any(query_kind) as query_kind,
        count() as count,
        sum(query_duration_ms) as total_duration_ms,
        avg(query_duration_ms) as avg_duration_ms,
        max(query_duration_ms) as max_duration_ms,
        sum(memory_usage) as total_memory,
        avg(memory_usage) as avg_memory,
        max(memory_usage) as max_memory,
        sum(read_bytes) as total_read_bytes,
        avg(read_bytes) as avg_read_bytes,
        toString(max(event_time)) as last_event_time
      FROM system.query_log
      WHERE type = 'QueryFinish'
        AND event_date >= today() - 7
      GROUP BY normalized_query_hash
      ORDER BY ${orderBy}
      LIMIT ${limit}
    `);

    // Get summary stats
    const summaryResult = await client.query<{
      total_queries: number;
      total_duration_ms: number;
      total_memory: number;
      total_read_bytes: number;
      failed_queries: number;
    }>(`
      SELECT
        count() as total_queries,
        sum(query_duration_ms) as total_duration_ms,
        sum(memory_usage) as total_memory,
        sum(read_bytes) as total_read_bytes,
        countIf(exception_code != 0) as failed_queries
      FROM system.query_log
      WHERE event_date >= today() - 7
    `);

    const summary = (
      summaryResult.data as unknown as Array<{
        total_queries: number;
        total_duration_ms: number;
        total_memory: number;
        total_read_bytes: number;
        failed_queries: number;
      }>
    )[0] || {
      total_queries: 0,
      total_duration_ms: 0,
      total_memory: 0,
      total_read_bytes: 0,
      failed_queries: 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        queries: result.data as unknown as ExpensiveQuery[],
        summary: {
          total_queries: Number(summary.total_queries),
          total_duration_ms: Number(summary.total_duration_ms),
          total_memory: Number(summary.total_memory),
          total_read_bytes: Number(summary.total_read_bytes),
          failed_queries: Number(summary.failed_queries),
        },
      },
    });
  } catch (error) {
    console.error("Query analytics error:", error);

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
        userMessage: "Failed to fetch query analytics",
      },
    });
  }
}
