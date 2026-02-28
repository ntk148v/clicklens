"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Activity,
  HeartPulse,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/monitoring";
import type { HealthStatus } from "@/lib/clickhouse/monitoring";

interface HealthSummaryProps {
  data: {
    overallStatus: HealthStatus;
    checks: Array<{
      name: string;
      status: HealthStatus;
    }>;
  } | undefined | null;
  isLoading: boolean;
}

export function HealthSummary({ data, isLoading }: HealthSummaryProps) {
  const [expanded, setExpanded] = useState(false);

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

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card
        className={
          data?.overallStatus === "ok"
            ? "border-green-500/50 bg-green-500/5"
            : data?.overallStatus === "warning"
              ? "border-yellow-500/50 bg-yellow-500/5"
              : data?.overallStatus === "critical"
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
                {isLoading ? (
                  <span className="text-muted-foreground text-xs">
                    Loading...
                  </span>
                ) : (
                  <StatusBadge
                    status={data?.overallStatus || "unknown"}
                    size="lg"
                  />
                )}
                {expanded ? (
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
            {data?.checks && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {data.checks.map((check) => (
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
  );
}
