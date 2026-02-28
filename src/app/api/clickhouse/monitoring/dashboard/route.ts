import { NextRequest, NextResponse } from "next/server";
import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient } from "@/lib/clickhouse";
import { MonitoringService, type DashboardResponse } from "@/services/monitoring";
import { successResponse, errorResponse, unauthorizedResponse, type ApiResponse } from "@/lib/api-response";

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<DashboardResponse>>> {
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

    const data = await service.getDashboardData({
      from,
      to,
      timeRange,
      minTime
    });

    return successResponse(data);
  } catch (error) {
    return errorResponse(error);
  }
}
