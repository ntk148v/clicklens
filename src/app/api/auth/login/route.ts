/**
 * API route for logging in with ClickHouse credentials
 * POST /api/auth/login
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/auth/session";

export interface LoginRequest {
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
  protocol?: "http" | "https";
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
    const body: LoginRequest = await request.json();

    // Validate required fields
    if (!body.host || !body.username) {
      return NextResponse.json(
        { success: false, error: "Host and username are required" },
        { status: 400 }
      );
    }

    const config = {
      host: body.host,
      port: body.port || 8123,
      username: body.username,
      password: body.password || "",
      database: body.database || "default",
      protocol: body.protocol || ("http" as const),
    };

    // Test connection to ClickHouse
    const url = `${config.protocol}://${config.host}:${
      config.port
    }/?query=${encodeURIComponent("SELECT version()")}`;

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
          error: errorText || "Failed to connect to ClickHouse",
        },
        { status: 401 }
      );
    }

    const version = (await response.text()).trim();

    // Store credentials in session
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(
      cookieStore,
      sessionOptions
    );

    session.isLoggedIn = true;
    session.clickhouse = config;
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
