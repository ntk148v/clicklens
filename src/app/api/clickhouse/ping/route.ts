/**
 * API route for testing ClickHouse connection
 * GET /api/clickhouse/ping
 */

import { NextResponse } from "next/server";
import { createClient, isClickHouseError } from "@/lib/clickhouse";

export interface PingResponse {
  success: boolean;
  connected: boolean;
  version?: string;
  error?: string;
}

export async function GET(): Promise<NextResponse<PingResponse>> {
  try {
    const client = createClient();

    const connected = await client.ping();

    if (!connected) {
      return NextResponse.json({
        success: true,
        connected: false,
        error: "Unable to connect to ClickHouse",
      });
    }

    const version = await client.version();

    return NextResponse.json({
      success: true,
      connected: true,
      version,
    });
  } catch (error) {
    console.error("Ping error:", error);

    return NextResponse.json({
      success: false,
      connected: false,
      error: isClickHouseError(error)
        ? error.message
        : error instanceof Error
        ? error.message
        : "Unknown error",
    });
  }
}
