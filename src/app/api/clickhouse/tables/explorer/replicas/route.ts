/**
 * API route for table explorer - replication status
 * GET /api/clickhouse/tables/explorer/replicas?database=xxx&table=yyy
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
import { getTableReplicasQuery } from "@/lib/clickhouse/queries/tables";
import { getOrSet, tablesCache } from "@/lib/cache";

export interface ReplicaInfo {
  is_leader: number;
  is_readonly: number;
  is_session_expired: number;
  future_parts: number;
  parts_to_check: number;
  queue_size: number;
  inserts_in_queue: number;
  merges_in_queue: number;
  log_pointer: number;
  total_replicas: number;
  active_replicas: number;
  last_queue_update: string;
  absolute_delay: number;
  zookeeper_path: string;
  replica_path: string;
  replica_name: string;
  node?: string;
}

interface ReplicasResponse {
  success: boolean;
  data?: {
    replicas: ReplicaInfo[];
    is_replicated: boolean;
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
): Promise<NextResponse<ReplicasResponse>> {
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

    const cacheKey = `tables:replicas:${database}:${table}`;

    const data = await getOrSet(
      tablesCache,
      cacheKey,
      async () => {
        // Auto-detect cluster
        const clusterName = await getClusterName(client);

        const result = await client.query<ReplicaInfo>(
          getTableReplicasQuery(safeDatabase, safeTable, clusterName),
        );

        const replicas = result.data as unknown as ReplicaInfo[];

        return {
          replicas,
          is_replicated: replicas.length > 0,
        };
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
    console.error("Table replicas error:", error);

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
        userMessage: "Failed to fetch replica status",
      },
    });
  }
}
