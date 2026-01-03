"use client";

import { Header } from "@/components/layout";
import { OperationsTab } from "@/components/monitoring";

export default function MonitoringOperationsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Background Operations" />

      <div className="flex-1 p-6 overflow-auto">
        <OperationsTab refreshInterval={10000} />
      </div>
    </div>
  );
}
