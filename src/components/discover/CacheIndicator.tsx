"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";

const STALE_CACHE_THRESHOLD_MS = 3600000;

interface CacheIndicatorProps {
  isCached: boolean;
  cacheAge?: number;
  hitRate?: number;
  totalHits?: number;
  totalMisses?: number;
  cacheSource?: 'redis' | 'memory';
}

export function CacheIndicator({
  isCached,
  cacheAge = 0,
  hitRate,
  totalHits,
  totalMisses,
  cacheSource = 'redis',
}: CacheIndicatorProps) {
  if (!isCached) {
    return null;
  }

  const formatAge = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const isStale = cacheAge > STALE_CACHE_THRESHOLD_MS;
  const badgeColor = isStale ? "text-yellow-600 bg-yellow-500/20 border-yellow-500/30" : "text-green-600 bg-green-500/20 border-green-500/30";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn(badgeColor, "gap-1.5 cursor-help")}>
            <Database className="h-3 w-3" />
            Cached
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-64">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cache Status</span>
              <span className="text-xs text-muted-foreground">{formatAge(cacheAge)}</span>
            </div>
            {hitRate !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Hit Rate</span>
                <span className="text-xs font-mono">{hitRate.toFixed(1)}%</span>
              </div>
            )}
            {totalHits !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total Hits</span>
                <span className="text-xs font-mono">{totalHits}</span>
              </div>
            )}
            {totalMisses !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total Misses</span>
                <span className="text-xs font-mono">{totalMisses}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">Source</span>
              <span className="text-xs font-mono">{cacheSource}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}