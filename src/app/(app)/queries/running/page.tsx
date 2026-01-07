"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { RefreshControl } from "@/components/monitoring";
import { RunningTab } from "@/components/queries";

export default function RunningQueriesPage() {
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Convert seconds to ms
  const refreshIntervalMs = refreshInterval * 1000;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Running Queries"
        actions={
          <RefreshControl
            onRefresh={handleRefresh}
            intervals={[5, 10, 30, 60]}
            interval={refreshInterval}
            onIntervalChange={setRefreshInterval}
            defaultInterval={5}
          />
        }
      />

      <div className="flex-1 p-4 overflow-hidden">
        <RunningTab
          key={`running-${refreshKey}`}
          refreshInterval={refreshIntervalMs}
        />
      </div>
    </div>
  );
}
