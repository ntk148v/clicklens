"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { KeeperTab } from "@/components/monitoring";
import { RefreshControl } from "@/components/monitoring";

export default function MonitoringKeeperPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="ZooKeeper / Keeper"
        actions={
          <RefreshControl
            onRefresh={handleRefresh}
            intervals={[10, 30, 60, 120]}
            defaultInterval={30}
          />
        }
      />

      <div className="flex-1 p-6 overflow-auto">
        <KeeperTab key={`keeper-${refreshKey}`} refreshInterval={30000} />
      </div>
    </div>
  );
}
