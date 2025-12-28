/**
 * API route for listing accessible databases
 * GET /api/clickhouse/databases
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";

interface DatabasesResponse {
  success: boolean;
  data?: Array<{ name: string }>;
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

export async function GET(): Promise<NextResponse<DatabasesResponse>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 401,
            message: "Not authenticated",
            type: "AUTH_REQUIRED",
            userMessage: "Please log in to ClickHouse first",
          },
        },
        { status: 401 }
      );
    }

    const client = createClientWithConfig(config);

    // Get databases, excluding system databases
    const result = await client.query(`
      SELECT name 
      FROM system.databases 
      WHERE name NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')
      ORDER BY name
    `);

    return NextResponse.json({
      success: true,
      data: result.data as Array<{ name: string }>,
    });
  } catch (error) {
    console.error("Databases fetch error:", error);

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
        userMessage: "Failed to fetch databases",
      },
    });
  }
}
