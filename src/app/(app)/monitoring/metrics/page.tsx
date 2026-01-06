"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { MetricsTab, RefreshControl } from "@/components/monitoring";

export default function MonitoringMetricsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [interval, setInterval] = useState(30);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

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
