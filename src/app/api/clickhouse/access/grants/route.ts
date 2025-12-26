/**
 * API route for fetching ClickHouse grants
 * GET /api/clickhouse/access/grants
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import {
  createClientWithConfig,
  isClickHouseError,
  type SystemGrant,
} from "@/lib/clickhouse";

export interface GrantsResponse {
  success: boolean;
  data?: SystemGrant[];
  error?: string;
}

export async function GET(): Promise<NextResponse<GrantsResponse>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const client = createClientWithConfig(config);

    const result = await client.query<SystemGrant>(`
      SELECT
        user_name,
        role_name,
        access_type,
        database,
        table,
        column,
        is_partial_revoke,
        grant_option
      FROM system.grants
      ORDER BY
        user_name NULLS LAST,
        role_name NULLS LAST,
        access_type
    `);

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error fetching grants:", error);

    return NextResponse.json({
      success: false,
      error: isClickHouseError(error)
        ? error.userMessage || error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    });
  }
}
