/**
 * API route for fetching ClickHouse roles
 * GET /api/clickhouse/access/roles
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import {
  createClientWithConfig,
  isClickHouseError,
  type SystemRole,
} from "@/lib/clickhouse";

export interface RolesResponse {
  success: boolean;
  data?: SystemRole[];
  error?: string;
}

export async function GET(): Promise<NextResponse<RolesResponse>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const client = createClientWithConfig(config);

    const result = await client.query<SystemRole>(`
      SELECT
        name,
        id,
        storage
      FROM system.roles
      ORDER BY name
    `);

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error fetching roles:", error);

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
