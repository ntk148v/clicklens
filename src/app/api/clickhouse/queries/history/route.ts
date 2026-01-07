/**
 * API route for query history
 * GET /api/clickhouse/queries/history?limit=100&offset=0&user=&minDuration=
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClientWithConfig,
  getLensConfig,
  isLensUserConfigured,
  isClickHouseError,
} from "@/lib/clickhouse";

export interface QueryHistoryEntry {
  event_time: string;
  query_id: string;
  query: string;
  query_kind: string;
  user: string;
  current_database: string;
  query_duration_ms: number;
  read_rows: number;
  read_bytes: number;
  written_rows: number;
  written_bytes: number;
  result_rows: number;
  memory_usage: number;
  type: string;
  exception_code: number;
  exception: string;
}

interface QueryHistoryResponse {
  success: boolean;
  data?: {
    queries: QueryHistoryEntry[];
    total: number;
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
): Promise<NextResponse<QueryHistoryResponse>> {
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);
    const offset = parseInt(searchParams.get("offset") || "0");
    const user = searchParams.get("user");
    const minDuration = searchParams.get("minDuration");
    const status = searchParams.get("status"); // all, success, error
    const queryType = searchParams.get("queryType"); // SELECT, INSERT, etc.
    const fingerprint = searchParams.get("fingerprint");

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

    const client = createClientWithConfig(lensConfig);

    // Build WHERE conditions
    // We want both finished queries and exceptions by default
    const conditions: string[] = [
      "type IN ('QueryFinish', 'ExceptionWhileProcessing')",
    ];

    if (status === "success") {
      conditions.push("type = 'QueryFinish' AND exception_code = 0");
    } else if (status === "error") {
      conditions.push(
        "(type = 'ExceptionWhileProcessing' OR exception_code != 0)"
      );
    }

    if (user) {
      const safeUser = user.replace(/'/g, "''");
      conditions.push(`user = '${safeUser}'`);
    }

    if (minDuration) {
      const ms = parseInt(minDuration);
      if (!isNaN(ms)) {
        conditions.push(`query_duration_ms >= ${ms}`);
      }
    }

    if (queryType) {
      const safeType = queryType.replace(/'/g, "''");
      conditions.push(`query_kind = '${safeType}'`);
    }

    if (fingerprint) {
      const safeFingerprint = fingerprint.replace(/'/g, "''");
      conditions.push(`normalized_query_hash = '${safeFingerprint}'`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countResult = await client.query<{ count: number }>(`
      SELECT count() as count FROM system.query_log ${whereClause}
    `);
    const total =
      (countResult.data as unknown as Array<{ count: number }>)[0]?.count || 0;

    // Get paginated results
    const result = await client.query<QueryHistoryEntry>(`
      SELECT
        toString(event_time) as event_time,
        query_id,
        query,
        query_kind,
        user,
        current_database,
        query_duration_ms,
        read_rows,
        read_bytes,
        written_rows,
        written_bytes,
        result_rows,
        memory_usage,
        type,
        exception_code,
        exception
      FROM system.query_log
      ${whereClause}
      ORDER BY event_time DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return NextResponse.json({
      success: true,
      data: {
        queries: result.data as unknown as QueryHistoryEntry[],
        total: Number(total),
      },
    });
  } catch (error) {
    console.error("Query history error:", error);

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
        userMessage: "Failed to fetch query history",
      },
    });
  }
}
