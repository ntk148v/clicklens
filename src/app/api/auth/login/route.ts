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
import { createSession, destroySession } from "@/lib/auth/storage";
import { generateCsrfToken } from "@/lib/auth/csrf";
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
  csrfToken?: string;
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

    if (!body.username) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 },
      );
    }

    const MAX_USERNAME_LENGTH = 256;
    const MAX_PASSWORD_LENGTH = 1024;

    if (body.username.length > MAX_USERNAME_LENGTH) {
      return NextResponse.json(
        { success: false, error: "Username is too long" },
        { status: 400 },
      );
    }

    if (body.password && body.password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { success: false, error: "Password is too long" },
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
      console.warn(
        "\x1b[33m%s\x1b[0m",
        "[Security Warning] SSL verification disabled for ClickHouse connection (CLICKHOUSE_VERIFY=false)",
      );
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
      console.error("ClickHouse authentication failed:", errorText);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid credentials",
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

    // SECURITY FIX: Prevent session fixation attacks
    // Destroy any existing session before creating a new one
    if (session.sessionId) {
      destroySession(session.sessionId);
    }
    session.destroy();

    // Store credentials in server-side session with fresh session ID
    const sessionId = createSession({
      username: body.username,
      password: body.password || "",
      host: config.host || process.env.CLICKHOUSE_HOST,
      database: config.database || "default",
    });

    session.isLoggedIn = true;
    session.sessionId = sessionId;

    // Clear legacy user object if present
    session.user = undefined;

    await session.save();

    const csrfToken = await generateCsrfToken();

    return NextResponse.json({
      success: true,
      version,
      csrfToken,
    });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Connection failed. Please verify the server is reachable.",
      },
      { status: 500 },
    );
  }
}
