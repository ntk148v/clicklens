"use client";

import { Header } from "@/components/layout";
import { OverviewTab } from "@/components/monitoring";

export default function MonitoringOverviewPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Cluster Overview" />

      <div className="flex-1 p-6 overflow-auto">
        <OverviewTab refreshInterval={30000} />
      </div>
    </div>
  );
}
