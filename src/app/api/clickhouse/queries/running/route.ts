/**
 * API route for running queries
 * GET /api/clickhouse/queries/running
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClientWithConfig,
  getLensConfig,
  isLensUserConfigured,
  isClickHouseError,
} from "@/lib/clickhouse";

export interface RunningQuery {
  query_id: string;
  user: string;
  query: string;
  elapsed: number;
  read_rows: number;
  read_bytes: number;
  memory_usage: number;
  is_initial_query: number;
  current_database: string;
  client_name: string;
}

interface RunningQueriesResponse {
  success: boolean;
  data?: RunningQuery[];
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<RunningQueriesResponse>> {
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

    const result = await client.query<RunningQuery>(`
      SELECT
        query_id,
        user,
        query,
        elapsed,
        read_rows,
        read_bytes,
        memory_usage,
        is_initial_query,
        current_database,
        client_name
      FROM system.processes
      WHERE is_initial_query = 1
      ORDER BY elapsed DESC
    `);

    return NextResponse.json({
      success: true,
      data: result.data as unknown as RunningQuery[],
    });
  } catch (error) {
    console.error("Running queries error:", error);

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
        userMessage: "Failed to fetch running queries",
      },
    });
  }
}
