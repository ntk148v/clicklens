"use client";

import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  status?: "ok" | "warning" | "critical";
  className?: string;
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
  trend,
  status,
  className,
  loading = false,
}: StatCardProps) {
  const statusColors = {
    ok: "status-ok",
    warning: "status-warning",
    critical: "status-critical",
  };

  const statusBgColors = {
    ok: "bg-status-ok",
    warning: "bg-status-warning",
    critical: "bg-status-critical",
  };

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-muted" />
            ) : (
              <div className="flex items-baseline gap-2">
                <p
                  className={cn(
                    "text-2xl font-bold",
                    status && statusColors[status]
                  )}
                >
                  {value}
                </p>
                {trend && (
                  <span
                    className={cn(
                      "text-xs font-medium",
                      trend.direction === "up" ? "status-ok" : "status-critical"
                    )}
                  >
                    {trend.direction === "up" ? "↑" : "↓"} {trend.value}%
                  </span>
                )}
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "p-2 rounded-lg",
                status ? statusBgColors[status] : "bg-primary/10",
                iconClassName
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5",
                  status ? statusColors[status] : "text-primary"
                )}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
