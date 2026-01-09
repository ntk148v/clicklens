/**
 * API route for table explorer - parts breakdown
 * GET /api/clickhouse/tables/explorer/parts?database=xxx&table=yyy
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

export interface PartInfo {
  partition: string;
  name: string;
  part_type: string;
  active: number;
  rows: number;
  bytes_on_disk: number;
  data_compressed_bytes: number;
  data_uncompressed_bytes: number;
  marks: number;
  modification_time: string;
  is_frozen: number;
  compression_ratio?: number;
}

interface PartsResponse {
  success: boolean;
  data?: {
    parts: PartInfo[];
    summary: {
      total_parts: number;
      total_rows: number;
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
): Promise<NextResponse<PartsResponse>> {
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
    const clusterName = await getClusterName(client);

    const safeDatabase = database.replace(/'/g, "''");
    const safeTable = table.replace(/'/g, "''");

    const tableSource = clusterName
      ? `clusterAllReplicas('${clusterName}', system.parts)`
      : "system.parts";

    const result = await client.query<PartInfo>(`
      SELECT
        partition,
        name,
        part_type,
        active,
        rows,
        bytes_on_disk,
        data_compressed_bytes,
        data_uncompressed_bytes,
        marks,
        toString(modification_time) as modification_time,
        is_frozen
      FROM ${tableSource}
      WHERE database = '${safeDatabase}' AND table = '${safeTable}' AND active = 1
      ORDER BY bytes_on_disk DESC
    `);

    const parts = result.data as unknown as PartInfo[];

    // Compute compression ratio for each part
    parts.forEach((part) => {
      if (part.data_uncompressed_bytes > 0) {
        part.compression_ratio =
          part.data_compressed_bytes / part.data_uncompressed_bytes;
      }
    });

    // Compute summary
    const summary = {
      total_parts: parts.length,
      total_rows: parts.reduce((sum, p) => sum + Number(p.rows), 0),
      total_bytes: parts.reduce((sum, p) => sum + Number(p.bytes_on_disk), 0),
      total_compressed: parts.reduce(
        (sum, p) => sum + Number(p.data_compressed_bytes),
        0
      ),
      total_uncompressed: parts.reduce(
        (sum, p) => sum + Number(p.data_uncompressed_bytes),
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
        parts,
        summary,
      },
    });
  } catch (error) {
    console.error("Table parts error:", error);

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
        userMessage: "Failed to fetch table parts",
      },
    });
  }
}
