/**
 * API route for fetching table columns (optimized for autocomplete)
 * GET /api/clickhouse/schema/columns?database=xxx&table=yyy
 *
 * Returns lightweight column information for autocomplete suggestions.
 * Uses the session user's credentials for proper access control.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClient,
  getUserConfig,
  isClickHouseError,
} from "@/lib/clickhouse";

export interface ColumnInfo {
  name: string;
  type: string;
  is_in_primary_key: boolean;
  is_in_sorting_key: boolean;
  comment: string;
}

interface ColumnsResponse {
  success: boolean;
  data?: ColumnInfo[];
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<ColumnsResponse>> {
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

    // Use the session user's credentials
    const config = getUserConfig({
      username: session.user.username,
      password: session.user.password,
    });

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 500,
            message: "Server connection not configured",
            type: "CONFIG_ERROR",
            userMessage: "Server not properly configured",
          },
        },
        { status: 500 }
      );
    }

    const client = createClient(config);

    // Escape single quotes in identifiers
    const safeDatabase = database.replace(/'/g, "''");
    const safeTable = table.replace(/'/g, "''");

    // Lightweight query optimized for autocomplete
    const result = await client.query<ColumnInfo>(`
      SELECT
        name,
        type,
        is_in_primary_key,
        is_in_sorting_key,
        comment
      FROM system.columns
      WHERE database = '${safeDatabase}' AND table = '${safeTable}'
      ORDER BY position
    `);

    return NextResponse.json({
      success: true,
      data: result.data as unknown as ColumnInfo[],
    });
  } catch (error) {
    console.error("Schema columns error:", error);

    if (isClickHouseError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            type: error.type,
            userMessage: error.userMessage || error.message,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 500,
          message: error instanceof Error ? error.message : "Unknown error",
          type: "INTERNAL_ERROR",
          userMessage: "Failed to fetch columns",
        },
      },
      { status: 500 }
    );
  }
}
