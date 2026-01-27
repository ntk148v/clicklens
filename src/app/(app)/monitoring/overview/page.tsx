"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth";
import { Header } from "@/components/layout";
import { OverviewTab } from "@/components/monitoring";
import { TimeSelector, RefreshControl } from "@/components/shared";
import { Loader2 } from "lucide-react";
import {
  FlexibleTimeRange,
  getFlexibleRangeFromEnum,
  TimeRange,
} from "@/lib/types/discover";

export default function MonitoringOverviewPage() {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [interval, setInterval] = useState(0);
  const [flexibleRange, setFlexibleRange] = useState<FlexibleTimeRange>(
    getFlexibleRangeFromEnum("1h"),
  );

  // Convert FlexibleTimeRange to minutes for the API
  const timeRangeMinutes = useMemo(() => {
    if (flexibleRange.type === "absolute") {
      return 60; // Fallback for absolute dates in this view
    }
    const rangeKey = flexibleRange.from.replace("now-", "") as TimeRange;
    const mapping: Record<string, number> = {
      "5m": 5,
      "15m": 15,
      "30m": 30,
      "60m": 60,
      "1h": 60,
      "3h": 180,
      "6h": 360,
      "12h": 720,
      "24h": 1440,
      "3d": 4320,
      "7d": 10080,
    };
    return mapping[rangeKey] || 60;
  }, [flexibleRange]);

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
          <div className="flex items-center gap-2">
            <TimeSelector value={flexibleRange} onChange={setFlexibleRange} />
            <RefreshControl
              onRefresh={handleRefresh}
              intervals={[10, 30, 60, 120]}
              interval={interval}
              onIntervalChange={setInterval}
            />
          </div>
        }
      />

      <div className="flex-1 p-6 overflow-auto">
        <OverviewTab
          key={`overview-${refreshKey}`}
          refreshInterval={interval * 1000}
          timeRange={timeRangeMinutes}
        />
      </div>
    </div>
  );
}
