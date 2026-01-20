/**
 * API route for killing ClickHouse queries
 * POST /api/clickhouse/kill
 *
 * Uses session credentials for authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";

interface KillRequest {
  queryId: string;
}

interface KillResponse {
  success: boolean;
  error?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<KillResponse>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body: KillRequest = await request.json();

    if (!body.queryId) {
      return NextResponse.json(
        { success: false, error: "Query ID is required" },
        { status: 400 }
      );
    }

    const client = createClient(config);
    await client.killQuery(body.queryId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Kill query error:", error);

    return NextResponse.json(
      {
        success: false,
        error: isClickHouseError(error)
          ? error.userMessage || error.message
          : error instanceof Error
          ? error.message
          : "Unknown error",
      },
      { status: 500 }, { status: 500 }
    );
  }
}
