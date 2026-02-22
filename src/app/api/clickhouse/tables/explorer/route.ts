/**
 * API route for table explorer - table overview metadata
 * GET /api/clickhouse/tables/explorer?database=xxx&table=yyy
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClient,
  getLensConfig,
  isLensUserConfigured,
  isClickHouseError,
} from "@/lib/clickhouse";
import { escapeSqlString } from "@/lib/clickhouse/utils";

export interface TableOverview {
  database: string;
  name: string;
  engine: string;
  total_rows: number;
  total_bytes: number;
  total_marks: number;
  parts: number;
  partition_key: string;
  sorting_key: string;
  primary_key: string;
  sampling_key: string;
  create_table_query: string;
  // Computed fields
  compression_ratio?: number;
  avg_row_size?: number;
}

interface TableOverviewResponse {
  success: boolean;
  data?: TableOverview;
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<TableOverviewResponse>> {
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
        { status: 401 },
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
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const database = searchParams.get("database");
    const table = searchParams.get("table");

    if (!database || !table) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 400,
            message: "Database and table parameters are required",
            type: "BAD_REQUEST",
            userMessage: "Please specify database and table",
          },
        },
        { status: 400 },
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

    const client = createClient(lensConfig);
    const safeDatabase = escapeSqlString(database);
    const safeTable = escapeSqlString(table);

    const result = await client.query<TableOverview>(`
      SELECT
        database,
        name,
        engine,
        total_rows,
        total_bytes,
        ifNull(total_marks, 0) as total_marks,
        ifNull(parts, 0) as parts,
        partition_key,
        sorting_key,
        primary_key,
        sampling_key,
        create_table_query
      FROM system.tables
      WHERE database = '${safeDatabase}' AND name = '${safeTable}'
    `);

    if (result.data.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 404,
          message: "Table not found",
          type: "NOT_FOUND",
          userMessage: `Table ${database}.${table} not found`,
        },
      });
    }

    const tableData = result.data[0] as unknown as TableOverview;

    // Compute derived fields
    if (tableData.total_rows > 0 && tableData.total_bytes > 0) {
      tableData.avg_row_size = tableData.total_bytes / tableData.total_rows;
    }

    return NextResponse.json({
      success: true,
      data: tableData,
    });
  } catch (error) {
    console.error("Table overview error:", error);

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
        userMessage: "Failed to fetch table overview",
      },
    });
  }
}
