/**
 * API route for listing tables in a database
 * GET /api/clickhouse/tables?database=xxx
 *
 * Uses LENS_USER for querying system.tables metadata.
 * Filters tables based on user's actual permissions (direct and via roles).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createClientWithConfig,
  getLensConfig,
  isLensUserConfigured,
  isClickHouseError,
} from "@/lib/clickhouse";

interface TableInfo {
  name: string;
  engine: string;
  total_rows: number;
  total_bytes: number;
}

interface TablesResponse {
  success: boolean;
  data?: TableInfo[];
  error?: {
    code: number;
    message: string;
    type: string;
    userMessage: string;
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<TablesResponse>> {
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

    const { searchParams } = new URL(request.url);
    const database = searchParams.get("database");

    if (!database) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 400,
            message: "Database parameter is required",
            type: "BAD_REQUEST",
            userMessage: "Please specify a database",
          },
        },
        { status: 400 }
      );
    }

    const lensConfig = getLensConfig();
    if (!lensConfig) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const client = createClientWithConfig(lensConfig);
    const safeUser = session.user.username.replace(/'/g, "''");
    const safeDatabase = database.replace(/'/g, "''");

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

      const grantFilter = userRoles
        ? `(user_name = '${safeUser}' OR role_name IN (${userRoles}))`
        : `user_name = '${safeUser}'`;

      // 1. Check for global access (*.*)
      const globalCheck = await client.query(`
        SELECT count() as cnt FROM system.grants 
        WHERE ${grantFilter}
        AND (database IS NULL OR database = '*')
        AND access_type IN ('SELECT', 'ALL')
      `);

      const globalData = globalCheck.data as unknown as Array<{
        cnt: string | number;
      }>;
      const cnt = globalData[0]?.cnt;
      const hasGlobalAccess = cnt !== 0 && cnt !== "0" && cnt !== undefined;

      // 2. Check for database level access (db.*)
      const dbCheck = await client.query(`
          SELECT count() as cnt FROM system.grants 
          WHERE ${grantFilter}
          AND database = '${safeDatabase}'
          AND (table IS NULL OR table = '*')
          AND access_type IN ('SELECT', 'INSERT', 'ALTER', 'CREATE', 'DROP', 'ALL')
        `);
      const dbData = dbCheck.data as unknown as Array<{ cnt: string | number }>;
      const dbCnt = dbData[0]?.cnt;
      const hasDbAccess = dbCnt !== 0 && dbCnt !== "0" && dbCnt !== undefined;

      let result;

      if (hasGlobalAccess || hasDbAccess) {
        // User has access to all tables in this database
        result = await client.query(`
          SELECT 
            name,
            engine,
            total_rows,
            total_bytes
          FROM system.tables 
          WHERE database = '${safeDatabase}'
          ORDER BY name
        `);
      } else {
        // User might have access to specific tables only
        // Get list of tables user has access to in this database
        const allowedTablesQuery = `
          SELECT DISTINCT table FROM system.grants
          WHERE ${grantFilter}
          AND database = '${safeDatabase}'
          AND table IS NOT NULL
          AND table != '*'
          AND access_type IN ('SELECT', 'INSERT', 'ALTER', 'CREATE', 'DROP', 'ALL')
        `;

        result = await client.query(`
          SELECT 
            name,
            engine,
            total_rows,
            total_bytes
          FROM system.tables 
          WHERE database = '${safeDatabase}'
          AND name IN (${allowedTablesQuery})
          ORDER BY name
        `);
      }

      return NextResponse.json({
        success: true,
        data: result.data as unknown as TableInfo[],
      });
    } catch (error) {
      console.error("Table permission check failed:", error);
      // If permission check fails, return empty list (safe default)
      return NextResponse.json({
        success: true,
        data: [],
      });
    }
  } catch (error) {
    console.error("Tables fetch error:", error);

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
        userMessage: "Failed to fetch tables",
      },
    });
  }
}
