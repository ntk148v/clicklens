/**
 * API route for listing accessible databases
 * GET /api/clickhouse/databases
 *
 * Uses LENS_USER (service account) to query system.grants
 * and filter databases by current user's permissions.
 * Checks both direct grants and grants through roles.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClient,
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

    const client = createClient(lensConfig);
    const safeUser = session.user.username.replace(/'/g, "''");

    try {
      // Get roles assigned to the user
      const rolesResult = await client.query(`
        SELECT granted_role_name as role 
        FROM system.role_grants 
        WHERE user_name = '${safeUser}'
      `);
      const rolesData = rolesResult.data as unknown as Array<{ role: string }>;

      const userRoles = rolesData
        .map((r) => `'${r.role.replace(/'/g, "''")}'`)
        .join(",");

      // Check global access (direct or through roles)
      const globalCheckQuery = userRoles
        ? `
          SELECT count() as cnt FROM system.grants 
          WHERE (
            user_name = '${safeUser}'
            OR role_name IN (${userRoles})
          )
          AND (database IS NULL OR database = '*')
          AND access_type IN ('SELECT', 'ALL')
        `
        : `
          SELECT count() as cnt FROM system.grants 
          WHERE user_name = '${safeUser}'
          AND (database IS NULL OR database = '*')
          AND access_type IN ('SELECT', 'ALL')
        `;

      const globalCheck = await client.query(globalCheckQuery);
      const globalData = globalCheck.data as unknown as Array<{
        cnt: string | number;
      }>;
      // Handle both string and number comparison
      const cnt = globalData[0]?.cnt;
      const hasGlobalAccess = cnt !== 0 && cnt !== "0" && cnt !== undefined;

      let result;
      if (hasGlobalAccess) {
        // User has global access, show all databases
        result = await client.query(
          `SELECT name FROM system.databases ORDER BY name`
        );
      } else {
        // Get databases from direct grants and role grants
        const dbQuery = userRoles
          ? `
            SELECT DISTINCT database as name FROM system.grants 
            WHERE (
              user_name = '${safeUser}'
              OR role_name IN (${userRoles})
            )
            AND database IS NOT NULL 
            AND database != '*'
            AND access_type IN ('SELECT', 'INSERT', 'ALTER', 'CREATE', 'DROP', 'ALL')
          `
          : `
            SELECT DISTINCT database as name FROM system.grants 
            WHERE user_name = '${safeUser}'
            AND database IS NOT NULL 
            AND database != '*'
            AND access_type IN ('SELECT', 'INSERT', 'ALTER', 'CREATE', 'DROP', 'ALL')
          `;

        result = await client.query(`
          SELECT DISTINCT name FROM (
            ${dbQuery}
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
    } catch (error) {
      console.error("Grants query failed:", error);
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
