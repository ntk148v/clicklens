/**
 * API route for disk monitoring
 * GET /api/clickhouse/monitoring/disks
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClientWithConfig, isClickHouseError } from "@/lib/clickhouse";
import {
  DISKS_QUERY,
  DISK_SUMMARY_QUERY,
  type DiskInfo,
  type MonitoringApiResponse,
} from "@/lib/clickhouse/monitoring";

interface DiskSummary {
  totalDisks: number;
  totalSpace: number;
  totalUsed: number;
  totalFree: number;
  overallUsedPercentage: number;
}

interface DisksResponse {
  disks: DiskInfo[];
  summary: DiskSummary;
}

export async function GET(): Promise<NextResponse<MonitoringApiResponse<DisksResponse>>> {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 401,
            message: "Not authenticated",
            type: "AUTH_REQUIRED",
            userMessage: "Please log in to ClickHouse first",
          },
        },
        { status: 401 }
      );
    }

    const client = createClientWithConfig(config);

    // Fetch disks and summary in parallel
    const [disksResult, summaryResult] = await Promise.all([
      client.query<DiskInfo>(DISKS_QUERY),
      client.query<DiskSummary>(DISK_SUMMARY_QUERY),
    ]);

    const summary = summaryResult.data[0] || {
      totalDisks: 0,
      totalSpace: 0,
      totalUsed: 0,
      totalFree: 0,
      overallUsedPercentage: 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        disks: disksResult.data,
        summary,
      },
    });
  } catch (error) {
    console.error("Monitoring disks error:", error);

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
        userMessage: "An unexpected error occurred",
      },
    });
  }
}
