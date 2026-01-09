"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server,
  AlertCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { StatCard, StatusDot } from "@/components/monitoring";
import type {
  MonitoringApiResponse,
  ClusterInfo,
  ClusterSummary,
  ClusterNode,
} from "@/lib/clickhouse/monitoring";

interface ClusterTabProps {
  refreshInterval?: number;
}

interface ClusterNodesResponse {
  clusters: ClusterInfo[];
  summary: ClusterSummary;
}

export function ClusterTab({ refreshInterval = 30000 }: ClusterTabProps) {
  const [data, setData] = useState<ClusterNodesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/clickhouse/monitoring/cluster");
      const result: MonitoringApiResponse<ClusterNodesResponse> =
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
  }, []);

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

  const getNodeStatus = (node: ClusterNode) => {
    if (!node.isActive) return "critical";
    if (node.errorsCount > 0) return "warning";
    return "ok";
  };

  const getNodeStatusIcon = (node: ClusterNode) => {
    const status = getNodeStatus(node);
    return <XCircle className="w-4 h-4 status-critical" />;
    if (status === "warning")
      return <AlertTriangle className="w-4 h-4 status-warning" />;
    return <CheckCircle2 className="w-4 h-4 status-ok" />;
  };

  // Group nodes by shard for visualization
  const groupNodesByShard = (nodes: ClusterNode[]) => {
    const shards = new Map<number, ClusterNode[]>();
    nodes.forEach((node) => {
      const existing = shards.get(node.shardNum) || [];
      existing.push(node);
      shards.set(node.shardNum, existing);
    });
    return Array.from(shards.entries()).sort((a, b) => a[0] - b[0]);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Summary */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Cluster Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard
              title="Clusters"
              value={data?.summary.clusterCount ?? "-"}
              icon={Layers}
              loading={isLoading}
            />
            <StatCard
              title="Total Nodes"
              value={data?.summary.totalNodes ?? "-"}
              icon={Server}
              loading={isLoading}
            />
            <StatCard
              title="Active Nodes"
              value={data?.summary.activeNodes ?? "-"}
              status={data && data.summary.inactiveNodes > 0 ? "warning" : "ok"}
              loading={isLoading}
            />
            <StatCard
              title="Inactive Nodes"
              value={data?.summary.inactiveNodes ?? "-"}
              status={
                data && data.summary.inactiveNodes > 0 ? "critical" : "ok"
              }
              loading={isLoading}
            />
            <StatCard
              title="Total Shards"
              value={data?.summary.totalShards ?? "-"}
              loading={isLoading}
            />
            <StatCard
              title="Total Errors"
              value={data?.summary.totalErrors ?? "-"}
              status={data && data.summary.totalErrors > 0 ? "warning" : "ok"}
              loading={isLoading}
            />
          </div>
        </section>

        {/* Cluster Topology */}
        {data?.clusters.map((cluster) => (
          <section key={cluster.name} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Server className="w-5 h-5" />
                {cluster.name}
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">
                  {cluster.activeNodes}/{cluster.totalNodes} active
                </Badge>
                <Badge variant="outline">
                  {cluster.shards} shard{cluster.shards > 1 ? "s" : ""}
                </Badge>
                <Badge variant="outline">
                  {cluster.replicas} replica{cluster.replicas > 1 ? "s" : ""}
                </Badge>
              </div>
            </div>

            {/* Shard/Replica Grid */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Cluster Topology
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {groupNodesByShard(cluster.nodes).map(([shardNum, nodes]) => (
                    <div key={shardNum} className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Shard {shardNum}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {nodes
                          .sort((a, b) => a.replicaNum - b.replicaNum)
                          .map((node) => (
                            <Tooltip key={`${node.hostName}-${node.port}`}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`
                                    flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer
                                    transition-colors hover:bg-muted/50
                                    ${
                                      !node.isActive
                                        ? "border-status-critical bg-status-critical"
                                        : node.errorsCount > 0
                                        ? "border-status-warning bg-status-warning"
                                        : "border-status-ok bg-status-ok"
                                    }
                                  `}
                                >
                                  {getNodeStatusIcon(node)}
                                  <div className="flex flex-col">
                                    <span className="text-sm font-mono">
                                      {node.hostName}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Replica {node.replicaNum}
                                      {node.isLocal && " (local)"}
                                    </span>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="w-64">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">
                                      {node.hostName}
                                    </span>
                                    <StatusDot status={getNodeStatus(node)} />
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <span className="text-muted-foreground">
                                      Address:
                                    </span>
                                    <span className="font-mono">
                                      {node.hostAddress}:{node.port}
                                    </span>
                                    <span className="text-muted-foreground">
                                      Shard:
                                    </span>
                                    <span>{node.shardNum}</span>
                                    <span className="text-muted-foreground">
                                      Replica:
                                    </span>
                                    <span>{node.replicaNum}</span>
                                    <span className="text-muted-foreground">
                                      Active:
                                    </span>
                                    <span>{node.isActive ? "Yes" : "No"}</span>
                                    <span className="text-muted-foreground">
                                      Errors:
                                    </span>
                                    <span
                                      className={
                                        node.errorsCount > 0
                                          ? "text-yellow-500"
                                          : ""
                                      }
                                    >
                                      {node.errorsCount}
                                    </span>
                                    <span className="text-muted-foreground">
                                      Slowdowns:
                                    </span>
                                    <span>{node.slowdownsCount}</span>
                                    {node.estimatedRecoveryTime > 0 && (
                                      <>
                                        <span className="text-muted-foreground">
                                          Recovery:
                                        </span>
                                        <span>
                                          {node.estimatedRecoveryTime}s
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        ))}

        {/* Loading state */}
        {isLoading && !data && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && data?.clusters.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Server className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No cluster configuration found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This ClickHouse instance may be running in standalone mode
              </p>
            </CardContent>
          </Card>
        )}

        {/* Info footer */}
        <div className="p-4 rounded-lg bg-muted border">
          <p className="text-xs text-muted-foreground">
            Data sourced from{" "}
            <code className="text-primary">system.clusters</code>. Shows all
            configured cluster nodes with their shard and replica assignments.
            Green indicates active nodes, yellow indicates nodes with errors,
            red indicates inactive nodes.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
