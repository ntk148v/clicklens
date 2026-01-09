/**
 * API route for getting table structure and data preview
 * GET /api/clickhouse/tables/[table]?database=xxx&type=structure|data
 *
 * - Structure: Uses LENS_USER (metadata from system.columns)
 * - Data: Uses END_USER (respects user's data access permissions)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, getSessionClickHouseConfig } from "@/lib/auth";
import {
  createClient,
  getLensConfig,
  isLensUserConfigured,
  isClickHouseError,
} from "@/lib/clickhouse";

interface ColumnInfo {
  name: string;
  type: string;
  default_kind: string;
  default_expression: string;
  comment: string;
}

interface TableDetailResponse {
  success: boolean;
  data?: Record<string, unknown>[];
  meta?: Array<{ name: string; type: string }>;
  columns?: ColumnInfo[];
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
): Promise<NextResponse<TableDetailResponse>> {
  try {
    // Check session
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

    const { table } = await params;
    const { searchParams } = new URL(request.url);
    const database = searchParams.get("database");
    const type = searchParams.get("type") || "structure";

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

    const safeDatabase = database.replace(/'/g, "''");
    const safeTable = table.replace(/'/g, "''");

    if (type === "structure") {
      // Structure query uses LENS_USER (system metadata)
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
        return NextResponse.json({ success: true, columns: [] });
      }

      const client = createClient(lensConfig);

      const result = await client.query(`
        SELECT 
          name,
          type,
          default_kind,
          default_expression,
          comment
        FROM system.columns 
        WHERE database = '${safeDatabase}' AND table = '${safeTable}'
        ORDER BY position
      `);

      return NextResponse.json({
        success: true,
        columns: result.data as unknown as ColumnInfo[],
      });
    } else {
      // Data query uses END_USER (respects data access permissions)
      const userConfig = await getSessionClickHouseConfig();
      if (!userConfig) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 500,
              message: "User config not available",
              type: "CONFIG_ERROR",
              userMessage: "Session error",
            },
          },
          { status: 500 }
        );
      }

      const client = createClient(userConfig);

      const result = await client.query(
        `SELECT * FROM \`${safeDatabase}\`.\`${safeTable}\` LIMIT 100`
      );

      return NextResponse.json({
        success: true,
        data: result.data as Record<string, unknown>[],
        meta: result.meta,
      });
    }
  } catch (error) {
    console.error("Table detail fetch error:", error);

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
        userMessage: "Failed to fetch table details",
      },
    });
  }
}
