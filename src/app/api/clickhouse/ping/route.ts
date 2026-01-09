/**
 * API route for testing ClickHouse connection
 * GET /api/clickhouse/ping
 *
 * Uses session credentials for authentication
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient } from "@/lib/clickhouse";

export interface PingResponse {
  connected: boolean;
  version?: string;
  error?: string;
}

export async function GET(): Promise<NextResponse<PingResponse>> {
  try {
    // Get credentials from session
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json({
        connected: false,
        error: "Not authenticated",
      });
    }

    const client = createClient(config);

    const isConnected = await client.ping();

    if (!isConnected) {
      return NextResponse.json({
        connected: false,
        error: "Cannot reach ClickHouse server",
      });
    }

    const version = await client.version();

    return NextResponse.json({
      connected: true,
      version,
    });
  } catch (error) {
    console.error("Ping error:", error);

    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : "Connection failed",
    });
  }
}
