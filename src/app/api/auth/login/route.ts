/**
 * API route for logging in with ClickHouse credentials
 * POST /api/auth/login
 *
 * Connection details (host, port, protocol) come from environment.
 * Only username/password are provided by the user.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import {
  getUserConfig,
  buildClickHouseUrl,
  isLensUserConfigured,
} from "@/lib/clickhouse";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  version?: string;
  error?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<LoginResponse>> {
  try {
    // Check if server is configured
    if (!isLensUserConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Server not configured. Please set CLICKHOUSE_HOST and LENS_USER environment variables.",
        },
        { status: 500 }
      );
    }

    const body: LoginRequest = await request.json();

    // Validate required fields
    if (!body.username) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 }
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
        { status: 500 }
      );
    }

    // Test connection to ClickHouse
    const url = buildClickHouseUrl(
      config,
      `/?query=${encodeURIComponent("SELECT version()")}`
    );

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-ClickHouse-User": config.username,
        "X-ClickHouse-Key": config.password,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          success: false,
          error: errorText || "Invalid credentials",
        },
        { status: 401 }
      );
    }

    const version = (await response.text()).trim();

    // Store only user credentials in session
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(
      cookieStore,
      sessionOptions
    );

    session.isLoggedIn = true;
    session.user = {
      username: body.username,
      password: body.password || "",
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
      { status: 500 }
    );
  }
}
