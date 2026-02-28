"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth";
import { Header } from "@/components/layout";
import { OverviewTab } from "@/components/monitoring/overview-tab";
import { TimeSelector, RefreshControl } from "@/components/shared";
import { Loader2 } from "lucide-react";
import {
  FlexibleTimeRange,
  getFlexibleRangeFromEnum,
} from "@/lib/types/discover";
import type { DashboardResponse } from "@/services/monitoring";

interface MonitoringOverviewClientProps {
  initialData?: DashboardResponse | null;
}

export function MonitoringOverviewClient({ initialData }: MonitoringOverviewClientProps) {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [interval, setInterval] = useState(0);
  const [flexibleRange, setFlexibleRange] = useState<FlexibleTimeRange>(
    getFlexibleRangeFromEnum("1h"),
  );

  useEffect(() => {
    if (!authLoading && !permissions?.canViewCluster) {
      router.push("/");
    }
  }, [authLoading, permissions, router]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  if (authLoading || !permissions?.canViewCluster) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Cluster Overview"
        actions={
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <TimeSelector value={flexibleRange} onChange={setFlexibleRange} />
            <RefreshControl
              onRefresh={handleRefresh}
              interval={interval}
              onIntervalChange={setInterval}
            />
          </div>
        }
      />

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <OverviewTab
          key={`overview-${refreshKey}`}
          refreshInterval={interval * 1000}
          timeRange={flexibleRange}
          initialData={initialData}
        />
      </div>
    </div>
  );
}
