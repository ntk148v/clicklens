"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface RefreshControlProps {
  onRefresh: () => void;
  intervals?: number[]; // in seconds
  defaultInterval?: number;
  isLoading?: boolean;
  className?: string;
}

export function RefreshControl({
  onRefresh,
  intervals = [5, 10, 30, 60],
  defaultInterval = 30,
  isLoading = false,
  className,
}: RefreshControlProps) {
  const [refreshInterval, setRefreshInterval] = useState<number>(defaultInterval);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(defaultInterval);

  const handleRefresh = useCallback(() => {
    onRefresh();
    setCountdown(refreshInterval);
  }, [onRefresh, refreshInterval]);

  // Auto-refresh timer
  useEffect(() => {
    if (isPaused || refreshInterval === 0) return;

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleRefresh();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [refreshInterval, isPaused, handleRefresh]);

  // Reset countdown when interval changes
  useEffect(() => {
    setCountdown(refreshInterval);
  }, [refreshInterval]);

  const formatInterval = (seconds: number) => {
    if (seconds === 0) return "Off";
    if (seconds < 60) return `${seconds}s`;
    return `${seconds / 60}m`;
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Countdown indicator */}
      {!isPaused && refreshInterval > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {countdown}s
        </span>
      )}

      {/* Pause/Play button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setIsPaused(!isPaused)}
        title={isPaused ? "Resume auto-refresh" : "Pause auto-refresh"}
      >
        {isPaused ? (
          <Play className="h-4 w-4" />
        ) : (
          <Pause className="h-4 w-4" />
        )}
      </Button>

      {/* Manual refresh button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleRefresh}
        disabled={isLoading}
        title="Refresh now"
      >
        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
      </Button>

      {/* Interval selector */}
      <Select
        value={String(refreshInterval)}
        onValueChange={(value) => setRefreshInterval(Number(value))}
      >
        <SelectTrigger className="h-8 w-[80px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">Off</SelectItem>
          {intervals.map((i) => (
            <SelectItem key={i} value={String(i)}>
              {formatInterval(i)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
