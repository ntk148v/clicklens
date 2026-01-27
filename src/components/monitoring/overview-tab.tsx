"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Activity,
  Cpu,
  Database,
  HeartPulse,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MultiSeriesChart, MetricChart } from "@/components/monitoring";
import { StatusBadge } from "@/components/monitoring";
import { DataSourceBadge } from "@/components/ui/data-source-badge";
import { formatUptime, useHealthChecks } from "@/lib/hooks/use-monitoring";
import type {
  MonitoringApiResponse,
  HealthStatus,
} from "@/lib/clickhouse/monitoring";

interface TimeSeriesPoint {
  t: string;
  node: string;
  value: number;
}

interface ClusterNode {
  hostName: string;
  hostAddress: string;
  port: number;
  shardNum: number;
  replicaNum: number;
  isLocal: boolean;
  isActive: boolean;
  errorsCount: number;
}

interface DashboardData {
  server: {
    uptime: number;
    version: string;
    hostname: string;
  };
  cluster?: {
    name: string;
    totalNodes: number;
    activeNodes: number;
    inactiveNodes: number;
    totalShards: number;
    nodes: ClusterNode[];
  };
  clickhouse: {
    queriesPerSec: TimeSeriesPoint[];
    queriesRunning: TimeSeriesPoint[];
    mergesRunning: TimeSeriesPoint[];
    selectedRowsPerSec: TimeSeriesPoint[];
    insertedRowsPerSec: TimeSeriesPoint[];
    maxPartsPerPartition: TimeSeriesPoint[];
  };
  systemHealth: {
    memoryTracked: TimeSeriesPoint[];
    cpuUsage: TimeSeriesPoint[];
    ioWait: TimeSeriesPoint[];
    filesystemUsed: TimeSeriesPoint[];
    networkReceived: TimeSeriesPoint[];
  };
  nodes: string[];
}

interface OverviewTabProps {
  refreshInterval?: number;
  timeRange?: number;
}

// Transform per-node data for charts
function transformToChartData(data: TimeSeriesPoint[]) {
  return data.map((p) => ({
    timestamp: p.t,
    node: p.node,
    value: p.value,
  }));
}

// For single line charts (when only 1 node)
function transformToSingleSeries(data: TimeSeriesPoint[]) {
  return data.map((p) => ({
    timestamp: p.t,
    value: p.value,
  }));
}

export function OverviewTab({ timeRange = 60 }: OverviewTabProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthExpanded, setHealthExpanded] = useState(false);

  // Health checks
  const { data: healthData, isLoading: healthLoading } = useHealthChecks({
    refreshInterval: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/clickhouse/monitoring/dashboard?timeRange=${timeRange}`,
      );
      const result: MonitoringApiResponse<DashboardData> =
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

  const getHealthIcon = (status: HealthStatus) => {
    switch (status) {
      case "ok":
        return <CheckCircle2 className="w-4 h-4 status-ok" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 status-warning" />;
      case "critical":
        return <XCircle className="w-4 h-4 status-critical" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Determine if we should show multi-node charts
  const isMultiNode = data && data.nodes.length > 1;

  // Render chart - automatically handles single vs multi-node
  const renderChart = (
    title: string,
    chartData: TimeSeriesPoint[],
    options: { isBytes?: boolean; unit?: string } = {},
  ) => {
    const transformedData = transformToChartData(chartData);
    const nodes = data?.nodes || [];

    if (isMultiNode) {
      return (
        <MultiSeriesChart
          title={title}
          data={transformedData}
          nodes={nodes}
          isBytes={options.isBytes}
          unit={options.unit}
          height={140}
          showAxis
          loading={isLoading}
        />
      );
    }

    return (
      <MetricChart
        title={title}
        data={transformToSingleSeries(chartData)}
        isBytes={options.isBytes}
        unit={options.unit}
        height={140}
        showAxis
        loading={isLoading}
      />
    );
  };

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

  return (
    <div className="space-y-6">
      {/* Cluster Info + Nodes */}
      {data?.cluster && (
        <TooltipProvider>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Cluster: {data.cluster.name}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {data.cluster.activeNodes}/{data.cluster.totalNodes} active
                  </Badge>
                  <Badge variant="outline">
                    {data.cluster.totalShards} shard
                    {data.cluster.totalShards > 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.cluster.nodes.map((node) => (
                  <Tooltip key={`${node.hostName}-${node.port}`}>
                    <TooltipTrigger asChild>
                      <div
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer
                          transition-colors hover:bg-muted/50
                          ${
                            !node.isActive
                              ? "border-red-500/50 bg-red-500/5"
                              : node.errorsCount > 0
                                ? "border-yellow-500/50 bg-yellow-500/5"
                                : "border-green-500/50 bg-green-500/5"
                          }
                        `}
                      >
                        {node.isActive ? (
                          node.errorsCount > 0 ? (
                            <AlertTriangle className="w-4 h-4 status-warning" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 status-ok" />
                          )
                        ) : (
                          <XCircle className="w-4 h-4 status-critical" />
                        )}
                        <span className="text-sm font-mono">
                          {node.hostName}
                        </span>
                        {node.isLocal && (
                          <Badge variant="secondary" className="text-xs">
                            local
                          </Badge>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <span className="text-muted-foreground">Address:</span>
                        <span className="font-mono">
                          {node.hostAddress}:{node.port}
                        </span>
                        <span className="text-muted-foreground">Shard:</span>
                        <span>{node.shardNum}</span>
                        <span className="text-muted-foreground">Replica:</span>
                        <span>{node.replicaNum}</span>
                        <span className="text-muted-foreground">Errors:</span>
                        <span
                          className={
                            node.errorsCount > 0 ? "text-yellow-500" : ""
                          }
                        >
                          {node.errorsCount}
                        </span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>
        </TooltipProvider>
      )}

      {/* Single Node Info */}
      {!data?.cluster && data && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="w-4 h-4" />
              {data.server.hostname}
              <Badge variant="outline" className="ml-auto">
                v{data.server.version}
              </Badge>
              <Badge variant="outline">
                Uptime: {formatUptime(data.server.uptime)}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Health Summary - Collapsible */}
      <Collapsible open={healthExpanded} onOpenChange={setHealthExpanded}>
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
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer transition-colors py-3">
              <CardTitle className="flex items-center gap-2 justify-between">
                <span className="flex items-center gap-2">
                  <HeartPulse className="w-4 h-4" />
                  Health Status
                </span>
                <div className="flex items-center gap-2">
                  {healthLoading ? (
                    <span className="text-muted-foreground text-xs">
                      Loading...
                    </span>
                  ) : (
                    <StatusBadge
                      status={healthData?.overallStatus || "unknown"}
                      size="lg"
                    />
                  )}
                  {healthExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {healthData?.checks && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {healthData.checks.map((check) => (
                    <div
                      key={check.name}
                      className="flex items-center gap-2 text-sm p-2 rounded-md"
                    >
                      {getHealthIcon(check.status)}
                      <span className="truncate">{check.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ClickHouse Specific Metrics */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Database className="w-5 h-5" />
          ClickHouse Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderChart("Queries/sec", data?.clickhouse.queriesPerSec || [], {
            unit: "/s",
          })}
          {renderChart(
            "Queries Running",
            data?.clickhouse.queriesRunning || [],
          )}
          {renderChart(
            "Selected Rows/sec",
            data?.clickhouse.selectedRowsPerSec || [],
            { unit: "/s" },
          )}
          {renderChart(
            "Inserted Rows/sec",
            data?.clickhouse.insertedRowsPerSec || [],
            { unit: "/s" },
          )}
          {renderChart("Merges Running", data?.clickhouse.mergesRunning || [])}
          {renderChart(
            "Max Parts/Partition",
            data?.clickhouse.maxPartsPerPartition || [],
          )}
        </div>
      </section>

      {/* System Health Specific Metrics */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Cpu className="w-5 h-5" />
          System Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderChart(
            "Memory (tracked)",
            data?.systemHealth.memoryTracked || [],
            { isBytes: true },
          )}
          {renderChart("CPU Usage", data?.systemHealth.cpuUsage || [])}
          {renderChart("IO Wait", data?.systemHealth.ioWait || [], {
            unit: "s",
          })}
          {renderChart(
            "Filesystem Used",
            data?.systemHealth.filesystemUsed || [],
            { isBytes: true },
          )}
          {renderChart(
            "Network Received",
            data?.systemHealth.networkReceived || [],
            { isBytes: true },
          )}
        </div>
      </section>

      {/* Info footer */}
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
