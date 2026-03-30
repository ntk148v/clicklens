/**
 * API route for killing ClickHouse queries
 * POST /api/clickhouse/kill
 *
 * Uses session credentials for authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig, checkPermission } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";
import { checkRateLimit, getClientIdentifier } from "@/lib/auth/rate-limit";
import { requireCsrf } from "@/lib/auth/csrf";

interface KillRequest {
  queryId: string;
}

interface KillResponse {
  success: boolean;
  error?: string;
}

const KILL_RATE_LIMIT = process.env.RATE_LIMIT_KILL ? parseInt(process.env.RATE_LIMIT_KILL) : 20;
const KILL_RATE_WINDOW_MS = 60000;

export async function POST(
  request: NextRequest,
): Promise<NextResponse<KillResponse>> {
  try {
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(`kill:${clientId}`, KILL_RATE_LIMIT, KILL_RATE_WINDOW_MS);
    if (!rateLimit.success) {
      return NextResponse.json(
        { success: false, error: "Too many kill requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) } },
      );
    }

    // CSRF protection for state-changing operation
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const authError = await checkPermission("canKillQueries");
    if (authError) return authError;

    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const body: KillRequest = await request.json();

    if (!body.queryId) {
      return NextResponse.json(
        { success: false, error: "Query ID is required" },
        { status: 400 },
      );
    }

    const client = createClient(config);
    // Prefix query_id to match the format used in the query execution endpoint
    const prefixedQueryId = `clicklens-${config.username}-${body.queryId}`;
    await client.killQuery(prefixedQueryId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Kill query error:", error);

    return NextResponse.json(
      {
        success: false,
        error: isClickHouseError(error) && error.userMessage
          ? error.userMessage
          : "Failed to kill query",
      },
      { status: 500 },
    );
  }
}
