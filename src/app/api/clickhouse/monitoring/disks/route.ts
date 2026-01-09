/**
 * API route for disk monitoring (cluster-aware)
 * GET /api/clickhouse/monitoring/disks
 */

import { NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient, isClickHouseError } from "@/lib/clickhouse";
import { getClusterName } from "@/lib/clickhouse/cluster";
import {
  getDashboardDisksQuery,
  getDisksWithPartsQuery,
  type MonitoringApiResponse,
} from "@/lib/clickhouse/monitoring";

interface DiskInfo {
  node: string;
  name: string;
  path: string;
  freeSpace: number;
  totalSpace: number;
  usedSpace: number;
  usedPercentage: number;
  unreservedSpace: number;
  type: string;
}

interface PartsInfo {
  node: string;
  diskName: string;
  partsCount: number;
  totalRows: number;
  bytesOnDisk: number;
  compressedBytes: number;
  uncompressedBytes: number;
  compressionRatio: number;
}

interface DiskSummary {
  totalDisks: number;
  totalSpace: number;
  totalUsed: number;
  totalFree: number;
  overallUsedPercentage: number;
}

interface EnhancedDiskInfo extends DiskInfo {
  partsCount?: number;
  compressedBytes?: number;
  uncompressedBytes?: number;
  compressionRatio?: number;
}

interface DisksResponse {
  disks: EnhancedDiskInfo[];
  summary: DiskSummary;
  nodes: string[];
  clusterName?: string;
}

export async function GET(): Promise<
  NextResponse<MonitoringApiResponse<DisksResponse>>
> {
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

    const client = createClient(config);

    // Detect cluster
    const clusterName = await getClusterName(client);

    // Fetch disks and parts in parallel
    const [disksResult, partsResult] = await Promise.all([
      client.query<DiskInfo>(getDashboardDisksQuery(clusterName)),
      client.query<PartsInfo>(getDisksWithPartsQuery(clusterName)),
    ]);

    // Create parts lookup by node+disk
    const partsMap = new Map<string, PartsInfo>();
    partsResult.data.forEach((p) => {
      partsMap.set(`${p.node}:${p.diskName}`, p);
    });

    // Enhance disk info with parts data
    const enhancedDisks: EnhancedDiskInfo[] = disksResult.data.map((disk) => {
      const parts = partsMap.get(`${disk.node}:${disk.name}`);
      return {
        ...disk,
        partsCount: parts?.partsCount,
        compressedBytes: parts?.compressedBytes,
        uncompressedBytes: parts?.uncompressedBytes,
        compressionRatio: parts?.compressionRatio,
      };
    });

    // Extract unique nodes
    const nodes = [...new Set(enhancedDisks.map((d) => d.node))].sort();

    // Compute summary
    const summary: DiskSummary = {
      totalDisks: enhancedDisks.length,
      totalSpace: enhancedDisks.reduce((sum, d) => sum + d.totalSpace, 0),
      totalUsed: enhancedDisks.reduce((sum, d) => sum + d.usedSpace, 0),
      totalFree: enhancedDisks.reduce((sum, d) => sum + d.freeSpace, 0),
      overallUsedPercentage: 0,
    };
    summary.overallUsedPercentage =
      summary.totalSpace > 0
        ? Math.round((summary.totalUsed / summary.totalSpace) * 10000) / 100
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        disks: enhancedDisks,
        summary,
        nodes,
        clusterName,
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
