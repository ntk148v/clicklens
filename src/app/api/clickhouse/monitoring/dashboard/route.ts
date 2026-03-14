import { NextRequest } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient } from "@/lib/clickhouse";
import { monitoringCache } from "@/lib/cache";
import {
  MonitoringService,
  type DashboardResponse,
} from "@/services/monitoring";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const config = await getSessionClickHouseConfig();

    if (!config) {
      return unauthorizedResponse("Not authenticated");
    }

    const client = createClient(config);
    const service = new MonitoringService(client);

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const minTime = searchParams.get("minTime") || undefined;
    const timeRangeParam = searchParams.get("timeRange");
    const timeRange = timeRangeParam ? parseInt(timeRangeParam, 10) : 60;

    // Only cache non-incremental (full) requests.
    // Incremental updates (minTime present) must always be fresh.
    const isIncremental = !!minTime;
    const cacheKey = `dashboard:${timeRange}:${from ?? "_"}:${to ?? "_"}`;

    if (!isIncremental) {
      const cached = await monitoringCache.get(cacheKey);
      if (cached) {
        return successResponse(cached as DashboardResponse);
      }
    }

    const data = await service.getDashboardData({
      from,
      to,
      timeRange,
      minTime,
    });

    if (!isIncremental) {
      await monitoringCache.set(cacheKey, data);
    }

    return successResponse(data);
  } catch (error) {
    return errorResponse(error);
  }
}
