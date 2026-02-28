import { getSessionClickHouseConfig } from "@/lib/auth";
import { createClient } from "@/lib/clickhouse";
import { MonitoringService, type DashboardResponse } from "@/services/monitoring";
import { MonitoringOverviewClient } from "./client-page";

export const dynamic = "force-dynamic";

export default async function MonitoringOverviewPage() {
  const config = await getSessionClickHouseConfig();
  let initialData: DashboardResponse | null = null;

  if (config) {
    try {
      const client = createClient(config);
      const service = new MonitoringService(client);
      // Default to 1 hour (60 minutes) to match client default
      initialData = await service.getDashboardData({ timeRange: 60 });
    } catch (e) {
      console.error("Failed to fetch initial dashboard data", e);
      // Fail gracefully, let client retry
    }
  }

  return <MonitoringOverviewClient initialData={initialData} />;
}
