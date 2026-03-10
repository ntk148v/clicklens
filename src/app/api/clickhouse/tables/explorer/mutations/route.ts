/**
 * API route for table explorer - mutation status
 * GET /api/clickhouse/tables/explorer/mutations?database=xxx&table=yyy
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClient,
  getLensConfig,
  isLensUserConfigured,
  isClickHouseError,
} from "@/lib/clickhouse";
import { getClusterName } from "@/lib/clickhouse/cluster";
import { escapeSqlString } from "@/lib/clickhouse/utils";
import { getTableMutationsQuery } from "@/lib/clickhouse/queries/tables";

export interface MutationInfo {
  mutation_id: string;
  command: string;
  create_time: string;
  parts_to_do: number;
  is_done: number;
  latest_failed_part: string;
  latest_fail_time: string;
  latest_fail_reason: string;
  node?: string;
}

interface MutationsResponse {
  success: boolean;
  data?: {
    mutations: MutationInfo[];
    summary: {
      total: number;
      pending: number;
      completed: number;
      failed: number;
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
): Promise<NextResponse<MutationsResponse>> {
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

    // Auto-detect cluster
    const clusterName = await getClusterName(client);

    const result = await client.query<MutationInfo>(
      getTableMutationsQuery(safeDatabase, safeTable, clusterName),
    );

    const mutations = result.data as unknown as MutationInfo[];

    // Compute summary
    const summary = {
      total: mutations.length,
      pending: mutations.filter((m) => m.is_done === 0 && !m.latest_fail_reason)
        .length,
      completed: mutations.filter((m) => m.is_done === 1).length,
      failed: mutations.filter((m) => m.latest_fail_reason).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        mutations,
        summary,
      },
    });
  } catch (error) {
    console.error("Table mutations error:", error);

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
        userMessage: "Failed to fetch mutations",
      },
    });
  }
}
