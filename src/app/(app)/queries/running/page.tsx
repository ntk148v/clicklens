"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth";
import { Header } from "@/components/layout";
import { RefreshControl } from "@/components/monitoring";
import { RunningTab } from "@/components/queries";
import { Loader2 } from "lucide-react";

export default function RunningQueriesPage() {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !permissions?.canViewProcesses) {
      router.push("/");
    }
  }, [authLoading, permissions, router]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Convert seconds to ms
  const refreshIntervalMs = refreshInterval * 1000;

  if (authLoading || !permissions?.canViewProcesses) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
