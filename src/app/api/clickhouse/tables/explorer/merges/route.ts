/**
 * API route for table explorer - active merges
 * GET /api/clickhouse/tables/explorer/merges?database=xxx&table=yyy
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
import { getTableMergesQuery } from "@/lib/clickhouse/queries/tables";
import { getOrSet, tablesCache } from "@/lib/cache";

export interface MergeInfo {
  result_part_name: string;
  elapsed: number;
  progress: number;
  num_parts: number;
  source_part_names: string[];
  total_size_bytes_compressed: number;
  bytes_read_uncompressed: number;
  bytes_written_uncompressed: number;
  rows_read: number;
  rows_written: number;
  columns_written: number;
  memory_usage: number;
  is_mutation: number;
  merge_type: string;
  merge_algorithm: string;
}

interface MergesResponse {
  success: boolean;
  data?: {
    merges: MergeInfo[];
    summary: {
      active_merges: number;
      total_memory_usage: number;
      total_bytes_to_merge: number;
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
  request: NextRequest,
): Promise<NextResponse<MergesResponse>> {
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

    const cacheKey = `tables:merges:${database}:${table}`;

    const data = await getOrSet(
      tablesCache,
      cacheKey,
      async () => {
        const result = await client.query<MergeInfo>(
          getTableMergesQuery(safeDatabase, safeTable),
        );

        const merges = result.data as unknown as MergeInfo[];

        const summary = {
          active_merges: merges.length,
          total_memory_usage: merges.reduce(
            (sum, m) => sum + Number(m.memory_usage),
            0,
          ),
          total_bytes_to_merge: merges.reduce(
            (sum, m) => sum + Number(m.total_size_bytes_compressed),
            0,
          ),
        };

        return { merges, summary };
      },
    );

    const resp = NextResponse.json({
      success: true,
      data,
    });
    resp.headers.set(
      "Cache-Control",
      "public, s-maxage=10, stale-while-revalidate=30",
    );
    return resp;
  } catch (error) {
    console.error("Table merges error:", error);

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
        userMessage: "Failed to fetch merges",
      },
    });
  }
}
