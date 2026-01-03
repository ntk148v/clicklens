"use client";

import { Header } from "@/components/layout";
import { HealthTab } from "@/components/monitoring";

export default function MonitoringHealthPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Health Checks" />

      <div className="flex-1 p-6 overflow-auto">
        <HealthTab refreshInterval={30000} />
      </div>
    </div>
  );
}
