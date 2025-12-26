/**
 * API route for executing ClickHouse queries
 * POST /api/clickhouse/query
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  isClickHouseError,
  getErrorMessage,
} from "@/lib/clickhouse";

export interface QueryRequest {
  sql: string;
  database?: string;
  readonly?: boolean;
  max_execution_time?: number;
}

export interface QueryResponse {
  success: boolean;
  data?: unknown[];
  meta?: Array<{ name: string; type: string }>;
  rows?: number;
  rows_before_limit_at_least?: number;
  statistics?: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
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
    const body: QueryRequest = await request.json();

    if (!body.sql || typeof body.sql !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 400,
            message: "SQL query is required",
            type: "syntax",
            userMessage: "Please provide a SQL query",
          },
        },
        { status: 400 }
      );
    }

    const client = createClient();

    const result = await client.query(body.sql.trim(), {
      database: body.database,
      readonly: body.readonly,
      max_execution_time: body.max_execution_time,
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
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            type: error.type,
            userMessage: getErrorMessage(error),
          },
        },
        { status: error.type === "permission_denied" ? 403 : 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 500,
          message: error instanceof Error ? error.message : "Unknown error",
          type: "unknown",
          userMessage: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
