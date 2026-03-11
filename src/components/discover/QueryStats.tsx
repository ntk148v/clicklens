"use client";

import { Clock, Database, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QueryStats {
  executionTime: number;
  rowsScanned: number;
  rowsReturned: number;
  cacheHit?: boolean;
}

interface QueryStatsProps {
  stats: QueryStats | null;
  className?: string;
}

export function QueryStats({ stats, className }: QueryStatsProps) {
  if (!stats) {
    return null;
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 text-xs text-muted-foreground",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        <span>{formatTime(stats.executionTime)}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Database className="h-3.5 w-3.5" />
        <span>{formatNumber(stats.rowsReturned)} rows</span>
      </div>

      {stats.rowsScanned > 0 && stats.rowsScanned !== stats.rowsReturned && (
        <div className="flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 opacity-60" />
          <span className="opacity-60">
            {formatNumber(stats.rowsScanned)} scanned
          </span>
        </div>
      )}

      {stats.cacheHit && (
        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
          <Zap className="h-3.5 w-3.5" />
          <span>Cached</span>
        </div>
      )}
    </div>
  );
}