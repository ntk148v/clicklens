"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Database,
  Cpu,
  Network,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataSourceBadge } from "@/components/ui/data-source-badge";
import { useHealthChecks } from "@/lib/hooks/use-monitoring";
import type { FlexibleTimeRange } from "@/lib/types/discover";
import { getMinTimeFromRange, type TimeRange } from "@/lib/types/discover";
import type { DashboardResponse } from "@/services/monitoring";
import { ClusterInfo, NodeInfo, HealthSummary, MetricsGrid } from "@/components/monitoring/dashboard";

interface OverviewTabProps {
  refreshInterval?: number;
  timeRange: FlexibleTimeRange;
  initialData?: DashboardResponse | null;
}

export function OverviewTab({ timeRange, initialData }: OverviewTabProps) {
  const [data, setData] = useState<DashboardResponse | null>(initialData || null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  
  const hasDataRef = useRef(!!initialData);

  // Health checks
  const { data: healthData, isLoading: healthLoading } = useHealthChecks({
    refreshInterval: 0,
  });

  // Build API URL params from FlexibleTimeRange
  const apiParams = useMemo(() => {
    const params = new URLSearchParams();

    if (timeRange.type === "absolute") {
      params.set("from", timeRange.from);
      params.set("to", timeRange.to);
    } else {
      // Relative range: compute from/to from the range key
      const rangeKey = timeRange.from.replace("now-", "") as TimeRange;
      const minTime = getMinTimeFromRange(rangeKey);
      if (minTime) {
        params.set("from", minTime.toISOString());
        params.set("to", new Date().toISOString());
      } else {
        // Fallback to timeRange minutes
        params.set("timeRange", "60");
      }
    }

    return params.toString();
  }, [timeRange]);

  const fetchData = useCallback(async () => {
    try {
      if (!hasDataRef.current) {
         setIsLoading(true);
      }
      setError(null);

      const response = await fetch(
        `/api/clickhouse/monitoring/dashboard?${apiParams}`,
      );
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data as DashboardResponse);
        hasDataRef.current = true;
      } else if (result.error) {
        setError(result.error.userMessage || result.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, [apiParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <Card className="border-red-500/30">
        <CardContent className="py-8 text-center">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-500 font-medium">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchData}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const nodes = data?.nodes || [];
  const isMultiNode = nodes.length > 1;

  const clickhouseCharts = data ? [
    { title: "Queries/sec", data: data.clickhouse.queriesPerSec, options: { unit: "/s" } },
    { title: "Queries Running", data: data.clickhouse.queriesRunning },
    { title: "Selected Rows/sec", data: data.clickhouse.selectedRowsPerSec, options: { unit: "/s" } },
    { title: "Inserted Rows/sec", data: data.clickhouse.insertedRowsPerSec, options: { unit: "/s" } },
    { title: "Selected Bytes/sec", data: data.clickhouse.selectedBytesPerSec, options: { isBytes: true } },
    { title: "Inserted Bytes/sec", data: data.clickhouse.insertedBytesPerSec, options: { isBytes: true } },
    { title: "Merges Running", data: data.clickhouse.mergesRunning },
    { title: "Max Parts/Partition", data: data.clickhouse.maxPartsPerPartition },
  ] : [];

  const systemCharts = data ? [
    { title: "Memory (tracked)", data: data.systemHealth.memoryTracked, options: { isBytes: true } },
    { title: "OS CPU Usage (Userspace)", data: data.systemHealth.cpuUsage },
    { title: "OS CPU Usage (Kernel)", data: data.systemHealth.cpuKernel },
    { title: "IO Wait", data: data.systemHealth.ioWait, options: { unit: "s" } },
    { title: "Filesystem Used", data: data.systemHealth.filesystemUsed, options: { isBytes: true } },
    { title: "Read from Disk", data: data.systemHealth.diskRead, options: { isBytes: true } },
    { title: "Written to Disk", data: data.systemHealth.diskWrite, options: { isBytes: true } },
  ] : [];

  const networkCharts = data ? [
    { title: "Network Received Bytes/sec", data: data.systemHealth.networkReceived, options: { isBytes: true } },
    { title: "Network Send Bytes/sec", data: data.systemHealth.networkSent, options: { isBytes: true } },
    { title: "Concurrent Network Connections", data: data.systemHealth.networkConnections },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Cluster Info + Nodes */}
      {data?.cluster && <ClusterInfo cluster={data.cluster} />}

      {/* Single Node Info */}
      {!data?.cluster && data && <NodeInfo server={data.server} />}

      {/* Health Summary */}
      <HealthSummary data={healthData} isLoading={healthLoading} />

      {/* ClickHouse Specific Metrics */}
      <MetricsGrid 
        title="ClickHouse Metrics" 
        icon={<Database className="w-5 h-5" />} 
        charts={clickhouseCharts} 
        nodes={nodes} 
        isLoading={isLoading} 
      />

      {/* System Health Specific Metrics */}
      <MetricsGrid 
        title="System Health" 
        icon={<Cpu className="w-5 h-5" />} 
        charts={systemCharts} 
        nodes={nodes} 
        isLoading={isLoading} 
      />

      {/* Network Metrics */}
      <MetricsGrid 
        title="Network" 
        icon={<Network className="w-5 h-5" />} 
        charts={networkCharts} 
        nodes={nodes} 
        isLoading={isLoading} 
      />

      {/* Info footer */}
      <DataSourceBadge
        sources={[
          "system.metric_log",
          "system.asynchronous_metric_log",
          "system.query_log",
        ]}
        clusterAware={Boolean(isMultiNode)}
      />
    </div>
  );
}
