/**
 * API route for killing ClickHouse queries
 * POST /api/clickhouse/kill
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createClient,
  isClickHouseError,
  getErrorMessage,
} from "@/lib/clickhouse";

export interface KillRequest {
  query_id: string;
}

export interface KillResponse {
  success: boolean;
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<KillResponse>> {
  try {
    const body: KillRequest = await request.json();

    if (!body.query_id || typeof body.query_id !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 400,
            message: "query_id is required",
            type: "syntax",
            userMessage: "Please provide a query ID to kill",
          },
        },
        { status: 400 }
      );
    }

    const client = createClient();
    await client.killQuery(body.query_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Kill query error:", error);

    if (isClickHouseError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            type: error.type,
            userMessage: getErrorMessage(error),
          },
        },
        { status: error.type === "permission_denied" ? 403 : 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 500,
          message: error instanceof Error ? error.message : "Unknown error",
          type: "unknown",
          userMessage: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
