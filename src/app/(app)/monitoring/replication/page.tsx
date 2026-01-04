"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { ReplicationTab, RefreshControl } from "@/components/monitoring";

export default function MonitoringReplicationPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Replication Status"
        actions={
          <RefreshControl
            onRefresh={handleRefresh}
            intervals={[10, 30, 60, 120]}
            defaultInterval={30}
          />
        }
      />

      <div className="flex-1 p-6 overflow-auto">
        <ReplicationTab
          key={`replication-${refreshKey}`}
          refreshInterval={30000}
        />
      </div>
    </div>
  );
}
