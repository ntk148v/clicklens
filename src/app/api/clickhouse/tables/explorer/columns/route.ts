/**
 * API route for table explorer - column storage stats
 * GET /api/clickhouse/tables/explorer/columns?database=xxx&table=yyy
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClient,
  getLensConfig,
  isLensUserConfigured,
  isClickHouseError,
} from "@/lib/clickhouse";

export interface ColumnStats {
  column: string;
  type: string;
  rows: number;
  bytes_on_disk: number;
  compressed_bytes: number;
  uncompressed_bytes: number;
  compression_ratio: number;
}

interface ColumnsResponse {
  success: boolean;
  data?: {
    columns: ColumnStats[];
    summary: {
      total_columns: number;
      total_bytes: number;
      total_compressed: number;
      total_uncompressed: number;
      avg_compression_ratio: number;
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
): Promise<NextResponse<ColumnsResponse>> {
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
        { status: 400 }
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
    const safeDatabase = database.replace(/'/g, "''");
    const safeTable = table.replace(/'/g, "''");

    const result = await client.query<ColumnStats>(`
      SELECT
        column,
        any(type) AS type,
        sum(rows) AS rows,
        sum(column_bytes_on_disk) AS bytes_on_disk,
        sum(column_data_compressed_bytes) AS compressed_bytes,
        sum(column_data_uncompressed_bytes) AS uncompressed_bytes,
        if(sum(column_data_uncompressed_bytes) > 0,
           sum(column_data_compressed_bytes) / sum(column_data_uncompressed_bytes), 0
        ) AS compression_ratio
      FROM system.parts_columns
      WHERE database = '${safeDatabase}' AND table = '${safeTable}' AND active = 1
      GROUP BY column
      ORDER BY bytes_on_disk DESC
    `);

    let columns = result.data as unknown as ColumnStats[];

    // Fallback: if no parts_columns data, query system.columns for basic info
    // This handles views, empty tables, and other table types without parts
    if (columns.length === 0) {
      const fallbackResult = await client.query<ColumnStats>(`
        SELECT
          name AS column,
          type,
          0 AS rows,
          0 AS bytes_on_disk,
          0 AS compressed_bytes,
          0 AS uncompressed_bytes,
          0 AS compression_ratio
        FROM system.columns
        WHERE database = '${safeDatabase}' AND table = '${safeTable}'
        ORDER BY position
      `);
      columns = fallbackResult.data as unknown as ColumnStats[];
    }

    // Compute summary
    const summary = {
      total_columns: columns.length,
      total_bytes: columns.reduce((sum, c) => sum + Number(c.bytes_on_disk), 0),
      total_compressed: columns.reduce(
        (sum, c) => sum + Number(c.compressed_bytes),
        0
      ),
      total_uncompressed: columns.reduce(
        (sum, c) => sum + Number(c.uncompressed_bytes),
        0
      ),
      avg_compression_ratio: 0,
    };

    if (summary.total_uncompressed > 0) {
      summary.avg_compression_ratio =
        summary.total_compressed / summary.total_uncompressed;
    }

    return NextResponse.json({
      success: true,
      data: {
        columns,
        summary,
      },
    });
  } catch (error) {
    console.error("Table columns error:", error);

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
        userMessage: "Failed to fetch column stats",
      },
    });
  }
}
