/**
 * API route for listing tables in a database
 * GET /api/clickhouse/tables?database=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";

interface TableInfo {
  name: string;
  engine: string;
  total_rows: number;
  total_bytes: number;
}

interface TablesResponse {
  success: boolean;
  data?: TableInfo[];
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<TablesResponse>> {
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

    const { searchParams } = new URL(request.url);
    const database = searchParams.get("database");

    if (!database) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 400,
            message: "Database parameter is required",
            type: "BAD_REQUEST",
            userMessage: "Please specify a database",
          },
        },
        { status: 400 }
      );
    }

    const client = createClientWithConfig(config);

    // Get tables with basic info
    const result = await client.query(`
      SELECT 
        name,
        engine,
        total_rows,
        total_bytes
      FROM system.tables 
      WHERE database = '${database.replace(/'/g, "''")}'
      ORDER BY name
    `);

    return NextResponse.json({
      success: true,
      data: result.data as unknown as TableInfo[],
    });
  } catch (error) {
    console.error("Tables fetch error:", error);

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
        userMessage: "Failed to fetch tables",
      },
    });
  }
}
