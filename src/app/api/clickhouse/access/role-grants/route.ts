/**
 * API route for fetching ClickHouse role grants
 * GET /api/clickhouse/access/role-grants
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";

interface RoleGrant {
  user_name: string | null;
  role_name: string | null;
  granted_role_name: string;
  with_admin_option: boolean;
}

export interface RoleGrantsResponse {
  success: boolean;
  data?: RoleGrant[];
  error?: string;
}

export async function GET(): Promise<NextResponse<RoleGrantsResponse>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const client = createClientWithConfig(config);

    const result = await client.query<RoleGrant>(`
      SELECT
        user_name,
        role_name,
        granted_role_name,
        with_admin_option
      FROM system.role_grants
      ORDER BY
        user_name NULLS LAST,
        role_name NULLS LAST,
        granted_role_name
    `);

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error fetching role grants:", error);

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
