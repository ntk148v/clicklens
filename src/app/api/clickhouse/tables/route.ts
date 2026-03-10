/**
 * API route for listing tables in a database
 * GET /api/clickhouse/tables?database=xxx
 *
 * Uses LENS_USER for querying system.tables metadata.
 * Filters tables based on user's actual permissions (direct and via roles).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, getSessionClickHouseConfig } from "@/lib/auth";
import { metadataCache } from "@/lib/cache";
import {
  createClient,
  getLensConfig,
  isLensUserConfigured,
  isClickHouseError,
} from "@/lib/clickhouse";
import { escapeSqlString } from "@/lib/clickhouse/utils";
import {
  hasGlobalAccessViaShowGrants,
  probeUserDatabaseAccess,
} from "@/lib/clickhouse/grants";
import {
  getUserRolesQuery,
  getGlobalAccessQuery,
  getDbAccessQuery,
  getTablesQuery,
  getTablesForDbQuery,
  getAllowedTablesInDbQuery,
  getAllowedTablesAllDbsQuery,
  getTablesFilteredByAccessQuery,
  getTablesFilteredByTupleQuery,
  buildGrantFilter,
} from "@/lib/clickhouse/queries/tables";

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

    // Cache key includes username + database for per-user RBAC filtering
    const cacheKey = `tables:${session.user.username}:${database ?? "_all"}`;
    const cachedData = metadataCache.get(cacheKey) as TableInfo[] | undefined;
    if (cachedData) {
      const resp = NextResponse.json({ success: true, data: cachedData });
      resp.headers.set(
        "Cache-Control",
        "public, s-maxage=30, stale-while-revalidate=60",
      );
      return resp;
    }

    const client = createClient(lensConfig);
    const safeUser = escapeSqlString(session.user.username);
    const safeDatabase = database ? escapeSqlString(database) : null;

    try {
      // Get roles assigned to the user
      const rolesResult = await client.query(
        getUserRolesQuery(safeUser),
      );
      const rolesData = rolesResult.data as unknown as Array<{ role: string }>;

      const userRoles = rolesData.map((r) => r.role);
      const grantFilter = buildGrantFilter(safeUser, userRoles);

      // 1. Check for global access (*.*)
      const globalCheck = await client.query(
        getGlobalAccessQuery(grantFilter),
      );

      const globalData = globalCheck.data as unknown as Array<{
        cnt: string | number;
      }>;
      const cnt = globalData[0]?.cnt;
      let hasGlobalAccess = cnt !== 0 && cnt !== "0" && cnt !== undefined;

      // Fallback: SHOW GRANTS catches XML-configured users and GRANT ALL
      // that may not appear in system.grants
      if (!hasGlobalAccess) {
        hasGlobalAccess = await hasGlobalAccessViaShowGrants(
          lensConfig,
          session.user.username,
        );
      }

      // 2. Check for database level access (db.*) - ONLY if database is specified
      let hasDbAccess = false;
      if (safeDatabase && !hasGlobalAccess) {
        const dbCheck = await client.query(
          getDbAccessQuery(grantFilter, safeDatabase),
        );
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
        result = await client.query(
          getTablesQuery(dbFilter),
        );
      } else if (hasDbAccess && safeDatabase) {
        // DB access: Fetch all tables for this db
        result = await client.query(
          getTablesForDbQuery(safeDatabase),
        );
      } else {
        // Specific table access only
        // Complex case: find allowed tables
        let allowedTablesQuery;

        if (safeDatabase) {
          allowedTablesQuery = getAllowedTablesInDbQuery(grantFilter, safeDatabase);
        } else {
          allowedTablesQuery = getAllowedTablesAllDbsQuery(grantFilter);
        }

        if (safeDatabase) {
          result = await client.query(
            getTablesFilteredByAccessQuery(safeDatabase, allowedTablesQuery),
          );
        } else {
          result = await client.query(
            getTablesFilteredByTupleQuery(allowedTablesQuery),
          );
        }
      }

      const resultData = result.data as unknown as TableInfo[];

      // If no tables found, probe with user's own credentials
      if (resultData.length === 0) {
        const userConfig = await getSessionClickHouseConfig();
        if (userConfig) {
          const probeResult = await probeUserDatabaseAccess(userConfig);
          if (probeResult.hasAccess) {
            // User has access — list tables via LENS_USER
            const dbFilter = safeDatabase
              ? `WHERE database = '${safeDatabase}'`
              : "";
            const allTablesResult = await client.query(
              getTablesQuery(dbFilter),
            );
            return NextResponse.json({
              success: true,
              data: allTablesResult.data as unknown as TableInfo[],
            });
          }
        }
      }

      metadataCache.set(cacheKey, resultData);
      const resp = NextResponse.json({
        success: true,
        data: resultData,
      });
      resp.headers.set(
        "Cache-Control",
        "public, s-maxage=30, stale-while-revalidate=60",
      );
      return resp;
    } catch (error) {
      console.error("Table permission check failed:", error);

      // Fallback: try user's own credentials
      try {
        const userConfig = await getSessionClickHouseConfig();
        if (userConfig) {
          const probeResult = await probeUserDatabaseAccess(userConfig);
          if (probeResult.hasAccess) {
            const dbFilter = safeDatabase
              ? `WHERE database = '${safeDatabase}'`
              : "";
            const allTablesResult = await client.query(
              getTablesQuery(dbFilter),
            );
            return NextResponse.json({
              success: true,
              data: allTablesResult.data as unknown as TableInfo[],
            });
          }
        }
      } catch {
        /* ignore probe failure */
      }

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
