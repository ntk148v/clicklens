"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth";
import { Header } from "@/components/layout";
import { MetricsTab, RefreshControl } from "@/components/monitoring";
import { Loader2 } from "lucide-react";

export default function MonitoringMetricsPage() {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [interval, setInterval] = useState(0);

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
        title="System Metrics"
        actions={
          <RefreshControl
            onRefresh={handleRefresh}
            intervals={[10, 30, 60, 120]}
            interval={interval}
            onIntervalChange={setInterval}
          />
        }
      />

      <div className="flex-1 p-6 overflow-auto">
        <MetricsTab
          key={`metrics-${refreshKey}`}
          refreshInterval={interval * 1000}
        />
      </div>
    </div>
  );
}
