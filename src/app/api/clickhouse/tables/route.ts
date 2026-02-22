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
  createClient,
  getLensConfig,
  isLensUserConfigured,
  isClickHouseError,
} from "@/lib/clickhouse";
import { escapeSqlString } from "@/lib/clickhouse/utils";

interface TableInfo {
  database?: string;
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
  request: NextRequest,
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
        { status: 401 },
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
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const database = searchParams.get("database");

    // If database is provided, we fetch tables for that database.
    // If not, we fetch all tables for all databases (caching mode).

    const lensConfig = getLensConfig();
    if (!lensConfig) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const client = createClient(lensConfig);
    const safeUser = escapeSqlString(session.user.username);
    const safeDatabase = database ? escapeSqlString(database) : null;

    try {
      // Get roles assigned to the user
      const rolesResult = await client.query(`
        SELECT granted_role_name as role
        FROM system.role_grants
        WHERE user_name = '${safeUser}'
      `);
      const rolesData = rolesResult.data as unknown as Array<{ role: string }>;

      const userRoles = rolesData
        .map((r) => `'${escapeSqlString(r.role)}'`)
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

      // 2. Check for database level access (db.*) - ONLY if database is specified
      let hasDbAccess = false;
      if (safeDatabase && !hasGlobalAccess) {
        const dbCheck = await client.query(`
            SELECT count() as cnt FROM system.grants
            WHERE ${grantFilter}
            AND database = '${safeDatabase}'
            AND (table IS NULL OR table = '*')
            AND access_type IN ('SELECT', 'INSERT', 'ALTER', 'CREATE', 'DROP', 'ALL')
          `);
        const dbData = dbCheck.data as unknown as Array<{
          cnt: string | number;
        }>;
        const dbCnt = dbData[0]?.cnt;
        hasDbAccess = dbCnt !== 0 && dbCnt !== "0" && dbCnt !== undefined;
      }

      let result;

      if (hasGlobalAccess) {
        // Global access: Fetch all tables or for specific db
        const dbFilter = safeDatabase
          ? `WHERE database = '${safeDatabase}'`
          : "";
        result = await client.query(`
          SELECT
            database,
            name,
            engine,
            total_rows,
            total_bytes
          FROM system.tables
          ${dbFilter}
          ORDER BY database, name
        `);
      } else if (hasDbAccess && safeDatabase) {
        // DB access: Fetch all tables for this db
        result = await client.query(`
          SELECT
            database,
            name,
            engine,
            total_rows,
            total_bytes
          FROM system.tables
          WHERE database = '${safeDatabase}'
          ORDER BY name
        `);
      } else {
        // Specific table access only
        // Complex case: find allowed tables
        let allowedTablesQuery;

        if (safeDatabase) {
          allowedTablesQuery = `
              SELECT DISTINCT table FROM system.grants
              WHERE ${grantFilter}
              AND database = '${safeDatabase}'
              AND table IS NOT NULL
              AND table != '*'
              AND access_type IN ('SELECT', 'INSERT', 'ALTER', 'CREATE', 'DROP', 'ALL')
            `;
        } else {
          // For all databases
          allowedTablesQuery = `
              SELECT DISTINCT database, table FROM system.grants
              WHERE ${grantFilter}
              AND table IS NOT NULL
              AND table != '*'
              AND access_type IN ('SELECT', 'INSERT', 'ALTER', 'CREATE', 'DROP', 'ALL')
            `;
        }

        if (safeDatabase) {
          result = await client.query(`
              SELECT
                database,
                name,
                engine,
                total_rows,
                total_bytes
              FROM system.tables
              WHERE database = '${safeDatabase}'
              AND name IN (${allowedTablesQuery})
              ORDER BY name
            `);
        } else {
          // This might be inefficient if user has many grants, but it's the safest way without global/db permissions
          // We can join or filtering by tuple (database, name)
          result = await client.query(`
              SELECT
                database,
                name,
                engine,
                total_rows,
                total_bytes
              FROM system.tables
              WHERE (database, name) IN (${allowedTablesQuery})
              ORDER BY database, name
            `);
        }
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
