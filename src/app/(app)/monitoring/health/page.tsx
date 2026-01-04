"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { HealthTab, RefreshControl } from "@/components/monitoring";

export default function MonitoringHealthPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Health Checks"
        actions={
          <RefreshControl
            onRefresh={handleRefresh}
            intervals={[10, 30, 60, 120]}
            defaultInterval={30}
          />
        }
      />

      <div className="flex-1 p-6 overflow-auto">
        <HealthTab key={`health-${refreshKey}`} refreshInterval={30000} />
      </div>
    </div>
  );
}
