/**
 * API route for query cache status
 * GET /api/clickhouse/queries/cache
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClientWithConfig,
  getLensConfig,
  isLensUserConfigured,
  isClickHouseError,
} from "@/lib/clickhouse";

export interface QueryCacheEntry {
  query: string;
  query_id: string;
  result_size: number;
  stale: number;
  shared: number;
  compressed: number;
  expires_at: string;
  key_hash: string;
}

interface QueryCacheResponse {
  success: boolean;
  data?: {
    entries: QueryCacheEntry[];
    summary: {
      total_entries: number;
      total_size: number;
      stale_count: number;
    };
    available: boolean;
  };
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

export async function GET(): Promise<NextResponse<QueryCacheResponse>> {
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

    try {
      // Check if query_cache table exists (requires ClickHouse 23.4+)
      const result = await client.query<QueryCacheEntry>(`
        SELECT
          query,
          query_id,
          result_size,
          stale,
          shared,
          compressed,
          toString(expires_at) as expires_at,
          toString(key_hash) as key_hash
        FROM system.query_cache
        ORDER BY result_size DESC
        LIMIT 100
      `);

      const entries = result.data as unknown as QueryCacheEntry[];

      // Compute summary
      const summary = {
        total_entries: entries.length,
        total_size: entries.reduce((sum, e) => sum + Number(e.result_size), 0),
        stale_count: entries.filter((e) => e.stale === 1).length,
      };

      return NextResponse.json({
        success: true,
        data: {
          entries,
          summary,
          available: true,
        },
      });
    } catch (err) {
      // Query cache might not exist on older ClickHouse versions
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes("query_cache") ||
        errorMessage.includes("UNKNOWN_TABLE")
      ) {
        return NextResponse.json({
          success: true,
          data: {
            entries: [],
            summary: {
              total_entries: 0,
              total_size: 0,
              stale_count: 0,
            },
            available: false,
          },
        });
      }
      throw err;
    }
  } catch (error) {
    console.error("Query cache error:", error);

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
        userMessage: "Failed to fetch query cache",
      },
    });
  }
}
