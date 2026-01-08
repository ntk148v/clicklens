"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  XCircle,
  Database,
  Eye,
  Clock,
  Activity,
  Trash2,
  FileEdit,
  Search,
  List,
  Layers,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/monitoring";
import { StatusBadge } from "@/components/monitoring";
import { formatNumber } from "@/lib/hooks/use-monitoring";
import type { MonitoringApiResponse } from "@/lib/clickhouse/monitoring";

interface KeeperData {
  isConnected: boolean;
  sessions: number;
  watches: number;
  pendingRequests: number;
  exceptions: {
    hardware: number;
    user: number;
  };
  operations: {
    transactions: number;
    creates: number;
    removes: number;
    gets: number;
    sets: number;
    exists: number;
    lists: number;
    multi: number;
  };
  latency: {
    totalWaitUs: number;
    avgLatencyUs: number;
  };
}

interface KeeperTabProps {
  refreshInterval?: number;
}

export function KeeperTab({ refreshInterval = 30000 }: KeeperTabProps) {
  const [data, setData] = useState<KeeperData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/clickhouse/monitoring/keeper");
      const result: MonitoringApiResponse<KeeperData> = await response.json();

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

  const formatLatency = (us: number) => {
    if (us < 1000) return `${us.toFixed(0)}µs`;
    if (us < 1000000) return `${(us / 1000).toFixed(1)}ms`;
    return `${(us / 1000000).toFixed(2)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card
        className={
          data?.isConnected
            ? "border-status-ok bg-status-ok"
            : "border-status-critical bg-status-critical"
        }
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              ZooKeeper / ClickHouse Keeper
            </CardTitle>
            {data && (
              <StatusBadge
                status={data.isConnected ? "ok" : "critical"}
                label={data.isConnected ? "Connected" : "Disconnected"}
                size="lg"
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">
                {isLoading ? "-" : formatNumber(data?.sessions || 0)}
              </div>
              <div className="text-xs text-muted-foreground">Sessions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {isLoading ? "-" : formatNumber(data?.watches || 0)}
              </div>
              <div className="text-xs text-muted-foreground">Watches</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {isLoading ? "-" : formatNumber(data?.pendingRequests || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                Pending Requests
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {isLoading
                  ? "-"
                  : formatLatency(data?.latency.avgLatencyUs || 0)}
              </div>
              <div className="text-xs text-muted-foreground">Avg Latency</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exceptions */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Exceptions
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            title="Hardware Exceptions"
            value={data ? formatNumber(data.exceptions.hardware) : "-"}
            status={data && data.exceptions.hardware > 0 ? "critical" : "ok"}
            icon={XCircle}
            loading={isLoading}
          />
          <StatCard
            title="User Exceptions"
            value={data ? formatNumber(data.exceptions.user) : "-"}
            status={data && data.exceptions.user > 0 ? "warning" : "ok"}
            icon={XCircle}
            loading={isLoading}
          />
        </div>
      </section>

      {/* Operations */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Operations (Total)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Transactions"
            value={data ? formatNumber(data.operations.transactions) : "-"}
            icon={Zap}
            loading={isLoading}
          />
          <StatCard
            title="Creates"
            value={data ? formatNumber(data.operations.creates) : "-"}
            icon={FileEdit}
            loading={isLoading}
          />
          <StatCard
            title="Removes"
            value={data ? formatNumber(data.operations.removes) : "-"}
            icon={Trash2}
            loading={isLoading}
          />
          <StatCard
            title="Gets"
            value={data ? formatNumber(data.operations.gets) : "-"}
            icon={Search}
            loading={isLoading}
          />
          <StatCard
            title="Sets"
            value={data ? formatNumber(data.operations.sets) : "-"}
            icon={FileEdit}
            loading={isLoading}
          />
          <StatCard
            title="Exists"
            value={data ? formatNumber(data.operations.exists) : "-"}
            icon={Eye}
            loading={isLoading}
          />
          <StatCard
            title="Lists"
            value={data ? formatNumber(data.operations.lists) : "-"}
            icon={List}
            loading={isLoading}
          />
          <StatCard
            title="Multi"
            value={data ? formatNumber(data.operations.multi) : "-"}
            icon={Layers}
            loading={isLoading}
          />
        </div>
      </section>

      {/* Latency */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Latency
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            title="Total Wait Time"
            value={data ? formatLatency(data.latency.totalWaitUs) : "-"}
            icon={Clock}
            loading={isLoading}
          />
          <StatCard
            title="Average Latency"
            value={data ? formatLatency(data.latency.avgLatencyUs) : "-"}
            status={
              data && data.latency.avgLatencyUs > 100000
                ? "warning"
                : data && data.latency.avgLatencyUs > 1000000
                ? "critical"
                : "ok"
            }
            icon={Clock}
            loading={isLoading}
          />
        </div>
      </section>

      {/* Info */}
      <div className="p-4 rounded-lg bg-muted border">
        <p className="text-xs text-muted-foreground">
          Data sourced from <code className="text-primary">system.metrics</code>{" "}
          and <code className="text-primary">system.events</code> tables.
          ZooKeeper/Keeper is used for distributed coordination in ClickHouse
          cluster. High latency or exceptions may indicate cluster coordination
          issues.
        </p>
      </div>
    </div>
  );
}
