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

    try {
      // Try to get databases from system tables
      // This requires access to system database
      const globalCheck = await client.query(`
        SELECT count() as cnt FROM system.grants 
        WHERE user_name = currentUser() 
        AND (database IS NULL OR database = '*')
        AND access_type IN ('SELECT', 'ALL')
      `);

      const globalData = globalCheck.data as unknown as Array<{ cnt: string }>;
      const hasGlobalAccess = globalData[0]?.cnt !== "0";

      let result;
      if (hasGlobalAccess) {
        // User has global access, show all databases
        result = await client.query(
          `SELECT name FROM system.databases ORDER BY name`
        );
      } else {
        // Get specific databases from grants + always include default
        result = await client.query(`
          SELECT DISTINCT name FROM (
            SELECT database as name FROM system.grants 
            WHERE user_name = currentUser() 
            AND database IS NOT NULL 
            AND database != '*'
            AND access_type IN ('SELECT', 'INSERT', 'ALTER', 'CREATE', 'DROP', 'ALL')
            UNION ALL
            SELECT 'default' as name
          ) 
          WHERE name IN (SELECT name FROM system.databases)
          ORDER BY name
        `);
      }

      return NextResponse.json({
        success: true,
        data: result.data as unknown as Array<{ name: string }>,
      });
    } catch {
      // If system queries fail (no system access), return just default database
      // The user can type database names manually in queries
      return NextResponse.json({
        success: true,
        data: [{ name: "default" }],
      });
    }
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
