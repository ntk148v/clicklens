"use client";

import { Header } from "@/components/layout";
import { ReplicationTab } from "@/components/monitoring";

export default function MonitoringReplicationPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Replication Status" />

      <div className="flex-1 p-6 overflow-auto">
        <ReplicationTab refreshInterval={30000} />
      </div>
    </div>
  );
}
