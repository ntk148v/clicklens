"use client";

import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { StatusBadge } from "@/components/monitoring";
import { useHealthChecks, formatNumber } from "@/lib/hooks/use-monitoring";
import type { HealthStatus, HealthCheck } from "@/lib/clickhouse/monitoring";

interface HealthTabProps {
  refreshInterval?: number;
}

const statusIcons: Record<HealthStatus, React.ReactNode> = {
  ok: <CheckCircle2 className="w-5 h-5 status-ok" />,
  warning: <AlertTriangle className="w-5 h-5 status-warning" />,
  critical: <XCircle className="w-5 h-5 status-critical" />,
  unknown: <AlertCircle className="w-5 h-5 text-gray-500" />,
};

export function HealthTab({ refreshInterval = 30000 }: HealthTabProps) {
  const { data, isLoading, error } = useHealthChecks({
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

  const getOverallStatusMessage = (status: HealthStatus) => {
    switch (status) {
      case "ok":
        return "All systems operational";
      case "warning":
        return "Some issues need attention";
      case "critical":
        return "Critical issues detected";
      default:
        return "Status unknown";
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card
        className={
          data?.overallStatus === "critical"
            ? "border-red-500/50 bg-red-500/5"
            : data?.overallStatus === "warning"
            ? "border-yellow-500/50 bg-yellow-500/5"
            : data?.overallStatus === "ok"
            ? "border-green-500/50 bg-green-500/5"
            : ""
        }
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Cluster Health
            </CardTitle>
            {data && (
              <StatusBadge
                status={data.overallStatus}
                label={getOverallStatusMessage(data.overallStatus)}
                size="lg"
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {isLoading ? "-" : data?.okCount ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">Passing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {isLoading ? "-" : data?.warningCount ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {isLoading ? "-" : data?.criticalCount ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health Checks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-muted animate-pulse rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-full bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          : data?.checks.map((check) => (
              <HealthCheckCard key={check.id} check={check} />
            ))}
      </div>

      {/* Info */}
      <div className="p-4 rounded-lg bg-muted border">
        <p className="text-xs text-muted-foreground">
          Health checks are based on ClickHouse best practices and monitor
          critical metrics like replica status, parts count, insert delays, and
          ZooKeeper connectivity. Thresholds are configurable in the API.
        </p>
      </div>
    </div>
  );
}

function HealthCheckCard({ check }: { check: HealthCheck }) {
  const formatValue = (value: number | string) => {
    if (typeof value === "number") {
      return formatNumber(value);
    }
    return value;
  };

  return (
    <Card
      className={
        check.status === "critical"
          ? "border-red-500/30"
          : check.status === "warning"
          ? "border-yellow-500/30"
          : ""
      }
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {statusIcons[check.status]}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-sm truncate">{check.name}</h4>
              <span className="font-mono text-sm font-bold">
                {formatValue(check.value)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {check.message}
            </p>
            {check.threshold && (
              <p className="text-xs text-muted-foreground mt-1">
                Thresholds: Warning ≥ {check.threshold.warning}, Critical ≥{" "}
                {check.threshold.critical}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
