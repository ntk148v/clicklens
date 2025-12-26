/**
 * API route for fetching ClickHouse users
 * GET /api/clickhouse/access/users
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import {
  createClientWithConfig,
  isClickHouseError,
  type SystemUser,
} from "@/lib/clickhouse";

export interface UsersResponse {
  success: boolean;
  data?: SystemUser[];
  error?: string;
}

export async function GET(): Promise<NextResponse<UsersResponse>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const client = createClientWithConfig(config);

    const result = await client.query<SystemUser>(`
      SELECT
        name,
        id,
        storage,
        auth_type,
        host_ip,
        host_names,
        host_names_regexp,
        host_names_like,
        default_roles_all,
        default_roles_list,
        default_roles_except,
        grantees_any,
        grantees_list,
        grantees_except,
        default_database
      FROM system.users
      ORDER BY name
    `);

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error fetching users:", error);

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
