/**
 * API route for logging in with ClickHouse credentials
 * POST /api/auth/login
 *
 * Connection details (host, port, protocol) come from environment.
 * Only username/password are provided by the user.
 *
 * Rate limited to 5 attempts per IP per minute to prevent brute-force attacks.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import { checkRateLimit, getClientIdentifier } from "@/lib/auth/rate-limit";
import {
  getUserConfig,
  buildConnectionUrl,
  isLensUserConfigured,
} from "@/lib/clickhouse";
import https from "https";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  version?: string;
  error?: string;
  retryAfter?: number;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<LoginResponse>> {
  try {
    // Rate limiting check - 5 attempts per minute per IP
    const clientIp = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientIp, 5, 60000);

    if (!rateLimit.success) {
      const retryAfterSeconds = Math.ceil(rateLimit.resetIn / 1000);
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please try again in ${retryAfterSeconds} seconds.`,
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
          },
        },
      );
    }

    // Check if server is configured
    if (!isLensUserConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Server not configured. Please set CLICKHOUSE_HOST and LENS_USER environment variables.",
        },
        { status: 500 },
      );
    }

    const body: LoginRequest = await request.json();

    // Validate required fields
    if (!body.username) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 },
      );
    }

    // Get config with user credentials
    const config = getUserConfig({
      username: body.username,
      password: body.password || "",
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Server connection not configured" },
        { status: 500 },
      );
    }

    // Build connection URL and test connection
    const baseUrl = buildConnectionUrl(config);
    const url = `${baseUrl}/?query=${encodeURIComponent("SELECT version()")}`;

    // Configure fetch options for SSL
    const fetchOptions: RequestInit = {};
    if (config.secure && !config.verifySsl) {
      // @ts-expect-error - Node.js specific option
      fetchOptions.agent = new https.Agent({ rejectUnauthorized: false });
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-ClickHouse-User": config.username,
        "X-ClickHouse-Key": config.password,
      },
      ...fetchOptions,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          success: false,
          error: errorText || "Invalid credentials",
        },
        { status: 401 },
      );
    }

    const version = (await response.text()).trim();

    // Store only user credentials in session
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(
      cookieStore,
      sessionOptions,
    );

    session.isLoggedIn = true;
    session.user = {
      username: body.username,
      password: body.password || "",
      host: config.host || process.env.CLICKHOUSE_HOST,
      database: config.database || "default",
    };
    await session.save();

    return NextResponse.json({
      success: true,
      version,
    });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      },
      { status: 500 },
    );
  }
}
