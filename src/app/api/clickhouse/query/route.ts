/**
 * API route for executing ClickHouse queries
 * POST /api/clickhouse/query
 *
 * Uses session credentials for authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";

export interface QueryRequest {
  sql: string;
  timeout?: number;
  query_id?: string;
}

export interface QueryResponse {
  success: boolean;
  data?: Record<string, unknown>[];
  meta?: Array<{ name: string; type: string }>;
  rows?: number;
  rows_before_limit_at_least?: number;
  statistics?: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
    memory_usage?: number;
  };
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<QueryResponse>> {
  try {
    // Get credentials from session
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

    const body: QueryRequest = await request.json();

    if (!body.sql || typeof body.sql !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 400,
            message: "SQL query is required",
            type: "BAD_REQUEST",
            userMessage: "SQL query is required",
          },
        },
        { status: 400 }
      );
    }

    const client = createClientWithConfig(config);
    const result = await client.query(body.sql, {
      timeout: body.timeout,
      query_id: body.query_id,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      meta: result.meta,
      rows: result.rows,
      rows_before_limit_at_least: result.rows_before_limit_at_least,
      statistics: result.statistics,
    });
  } catch (error) {
    console.error("Query error:", error);

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
