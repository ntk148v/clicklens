/**
 * API route for listing accessible databases
 * GET /api/clickhouse/databases
 *
 * Uses LENS_USER (service account) to query system.grants
 * and filter databases by current user's permissions.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClientWithConfig,
  getLensConfig,
  isLensUserConfigured,
} from "@/lib/clickhouse";

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
    // Check session
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

    // Check lens user configuration
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

    const lensConfig = getLensConfig();
    if (!lensConfig) {
      return NextResponse.json({
        success: true,
        data: [{ name: "default" }],
      });
    }

    const client = createClientWithConfig(lensConfig);
    const currentUser = session.user.username;

    try {
      // Query grants using lens user to see what databases the current user can access
      const globalCheck = await client.query(`
        SELECT count() as cnt FROM system.grants 
        WHERE user_name = '${currentUser.replace(/'/g, "''")}'
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
        // Get specific databases from grants
        result = await client.query(`
          SELECT DISTINCT name FROM (
            SELECT database as name FROM system.grants 
            WHERE user_name = '${currentUser.replace(/'/g, "''")}'
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
      // If grants query fails, return just default database
      return NextResponse.json({
        success: true,
        data: [{ name: "default" }],
      });
    }
  } catch (error) {
    console.error("Databases fetch error:", error);

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
