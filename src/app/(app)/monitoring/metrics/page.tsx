"use client";

import { Header } from "@/components/layout";
import { MetricsTab } from "@/components/monitoring";

export default function MonitoringMetricsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="System Metrics" />

      <div className="flex-1 p-6 overflow-auto">
        <MetricsTab refreshInterval={30000} />
      </div>
    </div>
  );
}
