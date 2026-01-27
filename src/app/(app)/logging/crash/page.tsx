"use client";

import { useState } from "react";
import { LogsViewer } from "@/components/logging/LogsViewer";
import { Header } from "@/components/layout/Header";
import { TimeSelector, RefreshControl } from "@/components/shared";
import {
  getFlexibleRangeFromEnum,
  FlexibleTimeRange,
} from "@/lib/types/discover";

export default function CrashLogsPage() {
  const [flexibleRange, setFlexibleRange] = useState<FlexibleTimeRange>(
    getFlexibleRangeFromEnum("1h"),
  );
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Crash Logs"
        actions={
          <div className="flex items-center gap-2">
            <TimeSelector value={flexibleRange} onChange={setFlexibleRange} />
            <RefreshControl
              onRefresh={() => setRefreshKey((k) => k + 1)}
              interval={refreshInterval}
              onIntervalChange={setRefreshInterval}
            />
          </div>
        }
      />
      <div className="px-6 pt-6 flex-1 overflow-hidden">
        <LogsViewer
          source="crash_log"
          timeRange={flexibleRange}
          refreshKey={refreshKey}
        />
      </div>
    </div>
  );
}
