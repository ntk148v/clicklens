"use client";

import { Header } from "@/components/layout";
import { DisksTab } from "@/components/monitoring";

export default function MonitoringDisksPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Disk Usage" />

      <div className="flex-1 p-6 overflow-auto">
        <DisksTab refreshInterval={30000} />
      </div>
    </div>
  );
}
