"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { OperationsTab, RefreshControl } from "@/components/monitoring";

export default function MonitoringOperationsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Background Operations"
        actions={
          <RefreshControl
            onRefresh={handleRefresh}
            intervals={[5, 10, 30, 60]}
            defaultInterval={10}
          />
        }
      />

      <div className="flex-1 p-6 overflow-auto">
        <OperationsTab
          key={`operations-${refreshKey}`}
          refreshInterval={10000}
        />
      </div>
    </div>
  );
}
