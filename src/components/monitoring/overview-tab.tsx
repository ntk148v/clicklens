"use client";

import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Clock,
  GitMerge,
  AlertCircle,
} from "lucide-react";
import { StatCard } from "@/components/monitoring";
import { StatusBadge } from "@/components/monitoring";
import {
  useClusterOverview,
  formatUptime,
  formatBytes,
  formatNumber,
} from "@/lib/hooks/use-monitoring";

interface OverviewTabProps {
  refreshInterval?: number;
}

export function OverviewTab({ refreshInterval = 30000 }: OverviewTabProps) {
  const { data, isLoading, error } = useClusterOverview({
    refreshInterval,
  });

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  const getMemoryStatus = () => {
    if (!data) return undefined;
    if (data.memory.percentage >= 90) return "critical" as const;
    if (data.memory.percentage >= 75) return "warning" as const;
    return "ok" as const;
  };

  const getPartsStatus = () => {
    if (!data) return undefined;
    if (data.maxPartsPerPartition >= 500) return "critical" as const;
    if (data.maxPartsPerPartition >= 300) return "warning" as const;
    return "ok" as const;
  };

  const getReplicaStatus = () => {
    if (!data) return undefined;
    if (data.readonlyReplicas > 0) return "critical" as const;
    return "ok" as const;
  };

  return (
    <div className="space-y-6">
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Uptime"
          value={data ? formatUptime(data.uptime) : "-"}
          icon={Clock}
          loading={isLoading}
        />
        <StatCard
          title="Active Queries"
          value={data ? formatNumber(data.activeQueries) : "-"}
          icon={Activity}
          loading={isLoading}
        />
        <StatCard
          title="Connections"
          value={data ? formatNumber(data.connections.total) : "-"}
          description={
            data
              ? `TCP: ${data.connections.tcp} | HTTP: ${data.connections.http}`
              : undefined
          }
          icon={Network}
          loading={isLoading}
        />
        <StatCard
          title="Memory Usage"
          value={data ? `${data.memory.percentage}%` : "-"}
          description={
            data
              ? `${formatBytes(data.memory.used)} / ${formatBytes(data.memory.total)}`
              : undefined
          }
          icon={MemoryStick}
          status={getMemoryStatus()}
          loading={isLoading}
        />
        <StatCard
          title="Background Tasks"
          value={data ? formatNumber(data.backgroundPoolTasks) : "-"}
          icon={GitMerge}
          loading={isLoading}
        />
      </div>

      {/* Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Parts per Partition</span>
            {data && (
              <StatusBadge
                status={getPartsStatus() || "unknown"}
                size="sm"
              />
            )}
          </div>
          <p className="text-2xl font-bold">
            {data ? formatNumber(data.maxPartsPerPartition) : "-"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data?.maxPartsPerPartition && data.maxPartsPerPartition >= 300
              ? "Consider running OPTIMIZE or reducing insert frequency"
              : "Within normal range (< 300)"}
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Readonly Replicas</span>
            {data && (
              <StatusBadge
                status={getReplicaStatus() || "unknown"}
                size="sm"
              />
            )}
          </div>
          <p className="text-2xl font-bold">
            {data ? data.readonlyReplicas : "-"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data?.readonlyReplicas && data.readonlyReplicas > 0
              ? "Some replicas are in readonly mode"
              : "All replicas are writable"}
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Version</span>
          </div>
          <p className="text-lg font-mono">
            {data ? data.version : "-"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            ClickHouse server version
          </p>
        </div>
      </div>

      {/* Quick Info */}
      <div className="p-4 rounded-lg bg-muted border">
        <div className="flex items-start gap-3">
          <HardDrive className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <h4 className="text-sm font-medium">System Resources</h4>
            <p className="text-xs text-muted-foreground mt-1">
              This overview shows real-time metrics from{" "}
              <code className="text-primary">system.metrics</code> and{" "}
              <code className="text-primary">system.asynchronous_metrics</code>.
              Data refreshes automatically based on your selected interval.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
