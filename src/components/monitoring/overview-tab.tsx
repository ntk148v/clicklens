"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server,
  Activity,
  MemoryStick,
  GitMerge,
  ArrowUpDown,
  Clock,
  AlertCircle,
  Network,
  Zap,
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/monitoring";
import { MetricChart } from "@/components/monitoring";
import { StatusBadge } from "@/components/monitoring";
import { formatUptime, formatBytes, formatNumber, useHealthChecks } from "@/lib/hooks/use-monitoring";
import type { MonitoringApiResponse, HealthStatus } from "@/lib/clickhouse/monitoring";

interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

interface DashboardOverview {
  server: {
    uptime: number;
    version: string;
    tcpConnections: number;
    httpConnections: number;
  };
  queries: {
    running: number;
    threads: number;
    total: number;
    failed: number;
    selects: number;
    inserts: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    mergeMemory: number;
  };
  merges: {
    running: number;
    mutations: number;
    backgroundTasks: number;
    maxPartsPerPartition: number;
    mergedRows: number;
  };
  throughput: {
    insertedRows: number;
    insertedBytes: number;
    selectedRows: number;
    selectedBytes: number;
  };
  timeSeries: {
    queriesPerMinute: TimeSeriesPoint[];
    insertedRowsPerMinute: TimeSeriesPoint[];
    selectedBytesPerMinute: TimeSeriesPoint[];
    memoryUsage: TimeSeriesPoint[];
  };
}

interface OverviewTabProps {
  refreshInterval?: number;
  timeRange?: number;
}

export function OverviewTab({ 
  refreshInterval = 30000,
  timeRange: initialTimeRange = 60 
}: OverviewTabProps) {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(initialTimeRange);

  // Health checks data
  const { data: healthData, isLoading: healthLoading } = useHealthChecks({ refreshInterval });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/clickhouse/monitoring/overview?timeRange=${timeRange}`
      );
      const result: MonitoringApiResponse<DashboardOverview> =
        await response.json();

      if (result.success && result.data) {
        setData(result.data);
      } else if (result.error) {
        setError(result.error.userMessage || result.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (refreshInterval <= 0) return;
    const interval = window.setInterval(fetchData, refreshInterval);
    return () => window.clearInterval(interval);
  }, [refreshInterval, fetchData]);

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  const getPartsStatus = () => {
    if (!data) return undefined;
    if (data.merges.maxPartsPerPartition >= 500) return "critical" as const;
    if (data.merges.maxPartsPerPartition >= 300) return "warning" as const;
    return "ok" as const;
  };

  const getMemoryStatus = () => {
    if (!data) return undefined;
    if (data.memory.percentage >= 90) return "critical" as const;
    if (data.memory.percentage >= 75) return "warning" as const;
    return "ok" as const;
  };

  const getHealthIcon = (status: HealthStatus) => {
    switch (status) {
      case "ok":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "critical":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-end">
        <Select
          value={String(timeRange)}
          onValueChange={(v) => setTimeRange(Number(v))}
        >
          <SelectTrigger className="w-[140px]">
            <Clock className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">Last 15 min</SelectItem>
            <SelectItem value="60">Last 1 hour</SelectItem>
            <SelectItem value="360">Last 6 hours</SelectItem>
            <SelectItem value="1440">Last 24 hours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Health Summary - At the top */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <HeartPulse className="w-5 h-5" />
          Health Status
        </h2>
        <Card
          className={
            healthData?.overallStatus === "ok"
              ? "border-green-500/50 bg-green-500/5"
              : healthData?.overallStatus === "warning"
                ? "border-yellow-500/50 bg-yellow-500/5"
                : healthData?.overallStatus === "critical"
                  ? "border-red-500/50 bg-red-500/5"
                  : ""
          }
        >
          <CardContent className="p-4">
            {healthLoading ? (
              <div className="flex items-center gap-4">
                <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              </div>
            ) : healthData ? (
              <div className="flex flex-wrap items-center gap-4">
                <StatusBadge
                  status={healthData.overallStatus}
                  label={healthData.overallStatus.toUpperCase()}
                  size="lg"
                />
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {healthData.okCount} OK
                  </span>
                  {healthData.warningCount > 0 && (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      {healthData.warningCount} Warnings
                    </span>
                  )}
                  {healthData.criticalCount > 0 && (
                    <span className="flex items-center gap-1">
                      <XCircle className="w-4 h-4 text-red-500" />
                      {healthData.criticalCount} Critical
                    </span>
                  )}
                </div>
              </div>
            ) : null}
            {/* Show failed checks inline */}
            {healthData && (healthData.warningCount > 0 || healthData.criticalCount > 0) && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex flex-wrap gap-2">
                  {healthData.checks
                    .filter((c) => c.status !== "ok")
                    .map((check) => (
                      <div
                        key={check.id}
                        className="flex items-center gap-2 px-2 py-1 rounded bg-muted text-sm"
                      >
                        {getHealthIcon(check.status)}
                        <span>{check.name}</span>
                        <span className="text-muted-foreground">({check.value})</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Server Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Server className="w-5 h-5" />
          Server
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Uptime"
            value={data ? formatUptime(data.server.uptime) : "-"}
            icon={Clock}
            loading={isLoading}
          />
          <StatCard
            title="Version"
            value={data?.server.version || "-"}
            loading={isLoading}
          />
          <StatCard
            title="TCP Connections"
            value={data ? formatNumber(data.server.tcpConnections) : "-"}
            icon={Network}
            loading={isLoading}
          />
          <StatCard
            title="HTTP Connections"
            value={data ? formatNumber(data.server.httpConnections) : "-"}
            icon={Network}
            loading={isLoading}
          />
        </div>
      </section>

      {/* Queries Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Queries
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard
            title="Running"
            value={data ? formatNumber(data.queries.running) : "-"}
            icon={Zap}
            loading={isLoading}
          />
          <StatCard
            title="Threads"
            value={data ? formatNumber(data.queries.threads) : "-"}
            loading={isLoading}
          />
          <StatCard
            title="Total"
            value={data ? formatNumber(data.queries.total) : "-"}
            loading={isLoading}
          />
          <StatCard
            title="Failed"
            value={data ? formatNumber(data.queries.failed) : "-"}
            status={data && data.queries.failed > 0 ? "warning" : "ok"}
            loading={isLoading}
          />
          <StatCard
            title="Selects"
            value={data ? formatNumber(data.queries.selects) : "-"}
            loading={isLoading}
          />
          <StatCard
            title="Inserts"
            value={data ? formatNumber(data.queries.inserts) : "-"}
            loading={isLoading}
          />
        </div>
        {/* Queries per minute chart */}
        <MetricChart
          title="Queries per Minute"
          data={data?.timeSeries.queriesPerMinute || []}
          color="hsl(var(--chart-1))"
          height={150}
          showAxis
          loading={isLoading}
        />
      </section>

      {/* Throughput Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ArrowUpDown className="w-5 h-5" />
          Throughput
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Inserted Rows"
            value={data ? formatNumber(data.throughput.insertedRows) : "-"}
            loading={isLoading}
          />
          <StatCard
            title="Inserted Bytes"
            value={data ? formatBytes(data.throughput.insertedBytes) : "-"}
            loading={isLoading}
          />
          <StatCard
            title="Selected Rows"
            value={data ? formatNumber(data.throughput.selectedRows) : "-"}
            loading={isLoading}
          />
          <StatCard
            title="Selected Bytes"
            value={data ? formatBytes(data.throughput.selectedBytes) : "-"}
            loading={isLoading}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricChart
            title="Inserted Rows / Minute"
            data={data?.timeSeries.insertedRowsPerMinute || []}
            color="hsl(var(--chart-2))"
            height={150}
            showAxis
            loading={isLoading}
          />
          <MetricChart
            title="Selected Bytes / Minute"
            data={data?.timeSeries.selectedBytesPerMinute || []}
            unit=" B"
            color="hsl(var(--chart-3))"
            height={150}
            showAxis
            loading={isLoading}
          />
        </div>
      </section>

      {/* Memory Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MemoryStick className="w-5 h-5" />
          Memory
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Used"
            value={data ? formatBytes(data.memory.used) : "-"}
            description={data ? `${data.memory.percentage}% of total` : undefined}
            status={getMemoryStatus()}
            icon={MemoryStick}
            loading={isLoading}
          />
          <StatCard
            title="Total"
            value={data ? formatBytes(data.memory.total) : "-"}
            loading={isLoading}
          />
          <StatCard
            title="Merge Memory"
            value={data ? formatBytes(data.memory.mergeMemory) : "-"}
            loading={isLoading}
          />
          <StatCard
            title="Usage %"
            value={data ? `${data.memory.percentage}%` : "-"}
            status={getMemoryStatus()}
            loading={isLoading}
          />
        </div>
        <MetricChart
          title="Memory Usage (Peak)"
          data={data?.timeSeries.memoryUsage || []}
          unit=" B"
          color="hsl(var(--chart-4))"
          height={150}
          showAxis
          loading={isLoading}
        />
      </section>

      {/* Merges & Parts Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <GitMerge className="w-5 h-5" />
          Merges & Parts
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            title="Running Merges"
            value={data ? formatNumber(data.merges.running) : "-"}
            icon={GitMerge}
            loading={isLoading}
          />
          <StatCard
            title="Mutations"
            value={data ? formatNumber(data.merges.mutations) : "-"}
            loading={isLoading}
          />
          <StatCard
            title="Background Tasks"
            value={data ? formatNumber(data.merges.backgroundTasks) : "-"}
            loading={isLoading}
          />
          <StatCard
            title="Max Parts/Partition"
            value={data ? formatNumber(data.merges.maxPartsPerPartition) : "-"}
            status={getPartsStatus()}
            loading={isLoading}
          />
          <StatCard
            title="Merged Rows"
            value={data ? formatNumber(data.merges.mergedRows) : "-"}
            loading={isLoading}
          />
        </div>
      </section>

      {/* Info footer */}
      <Card className="bg-muted">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            Data sourced from <code className="text-primary">system.metrics</code>,{" "}
            <code className="text-primary">system.asynchronous_metrics</code>,{" "}
            <code className="text-primary">system.events</code>, and{" "}
            <code className="text-primary">system.query_log</code>. Charts show data for
            the selected time range. Metrics refresh every {refreshInterval / 1000}s.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
