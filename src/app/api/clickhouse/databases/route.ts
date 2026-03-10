/**
 * API route for listing accessible databases
 * GET /api/clickhouse/databases
 *
 * Uses LENS_USER (service account) to query system.grants
 * and filter databases by current user's permissions.
 * Checks both direct grants and grants through roles.
 */

import { NextResponse } from "next/server";
import { getSession, getSessionClickHouseConfig } from "@/lib/auth";
import { metadataCache } from "@/lib/cache";
import {
  createClient,
  getLensConfig,
  isLensUserConfigured,
} from "@/lib/clickhouse";
import { escapeSqlString } from "@/lib/clickhouse/utils";
import {
  hasGlobalAccessViaShowGrants,
  probeUserDatabaseAccess,
} from "@/lib/clickhouse/grants";
import { getDatabasesWithRbacQuery, ALL_DATABASES_QUERY } from "@/lib/clickhouse/queries/databases";

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

    const lensConfig = getLensConfig();
    if (!lensConfig) {
      return NextResponse.json({
        success: true,
        data: [{ name: "default" }],
      });
    }

    // Cache key includes username for per-user RBAC filtering
    const cacheKey = `databases:${session.user.username}`;
    const cachedData = metadataCache.get(cacheKey) as
      | Array<{ name: string }>
      | undefined;
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

    try {
      // Single complex query to evaluate RBAC and fetch allowed databases
      // 1. Get user's roles
      // 2. Check if user or their roles have global access (*.*)
      // 3. If global access, return all databases
      // 4. Otherwise, return only databases they have explicit access to (plus 'default')
      const mergedQuery = getDatabasesWithRbacQuery(safeUser);

      let result;
      let resultData: Array<{ name: string }> = [];
      let queryFailed = false;

      try {
        result = await client.query(mergedQuery);
        resultData = result.data as unknown as Array<{ name: string }>;
      } catch (err) {
        // Some older ClickHouse versions might struggle with the complex CTE
        // Keep track to fallback to probing
        queryFailed = true;
        console.warn(
          "Unified CTE grant query failed, falling back to probing:",
          err,
        );
      }

      // If the CTE query failed or returned empty (except maybe just 'default'),
      // try probing via SHOW GRANTS or user credentials as a fallback
      if (
        queryFailed ||
        resultData.length === 0 ||
        (resultData.length === 1 && resultData[0]?.name === "default")
      ) {
        // Let's at least check SHOW GRANTS logic for global access
        const hasGlobalFallback = await hasGlobalAccessViaShowGrants(
          lensConfig,
          session.user.username,
        );

        if (hasGlobalFallback) {
          const allDbsResult = await client.query(
            ALL_DATABASES_QUERY,
          );
          resultData = allDbsResult.data as unknown as Array<{ name: string }>;
        }
      }

      // If no databases found via system.grants, probe with user's own credentials
      if (
        resultData.length === 0 ||
        (resultData.length === 1 && resultData[0]?.name === "default")
      ) {
        const userConfig = await getSessionClickHouseConfig();
        if (userConfig) {
          const probeResult = await probeUserDatabaseAccess(userConfig);
          if (probeResult.hasAccess) {
            // User has access — list all databases via LENS_USER
            const allDbsResult = await client.query(
              `SELECT name FROM system.databases ORDER BY name`,
            );
            return NextResponse.json({
              success: true,
              data: allDbsResult.data as unknown as Array<{ name: string }>,
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
      console.error("Grants query failed:", error);

      // Fallback: try user's own credentials
      try {
        const userConfig = await getSessionClickHouseConfig();
        if (userConfig) {
          const probeResult = await probeUserDatabaseAccess(userConfig);
          if (probeResult.hasAccess) {
            const allDbsResult = await client.query(
              `SELECT name FROM system.databases ORDER BY name`,
            );
            return NextResponse.json({
              success: true,
              data: allDbsResult.data as unknown as Array<{ name: string }>,
            });
          }
        }
      } catch {
        /* ignore probe failure */
      }

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
