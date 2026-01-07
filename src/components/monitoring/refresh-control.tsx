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
  interval?: number; // controlled state
  onIntervalChange?: (interval: number) => void;
  defaultInterval?: number; // kept for backward compatibility if needed, but preferred to be controlled
  isLoading?: boolean;
  className?: string;
}

export function RefreshControl({
  onRefresh,
  intervals = [5, 10, 30, 60],
  interval,
  onIntervalChange,
  defaultInterval = 30,
  isLoading = false,
  className,
}: RefreshControlProps) {
  // Use controlled state if provided, otherwise local state
  const [internalInterval, setInternalInterval] =
    useState<number>(defaultInterval);
  const currentInterval = interval !== undefined ? interval : internalInterval;

  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(currentInterval);

  const handleRefresh = useCallback(() => {
    onRefresh();
    setCountdown(currentInterval);
  }, [onRefresh, currentInterval]);

  const handleIntervalChange = (newInterval: number) => {
    if (onIntervalChange) {
      onIntervalChange(newInterval);
    } else {
      setInternalInterval(newInterval);
    }
  };

  // Auto-refresh timer
  useEffect(() => {
    if (isPaused || currentInterval === 0) return;

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleRefresh();
          return currentInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentInterval, isPaused, handleRefresh]);

  // Reset countdown when interval changes
  useEffect(() => {
    setCountdown(currentInterval);
  }, [currentInterval]);

  const formatInterval = (seconds: number) => {
    if (seconds === 0) return "Off";
    if (seconds < 60) return `${seconds}s`;
    return `${seconds / 60}m`;
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Countdown indicator */}
      {!isPaused && currentInterval > 0 && (
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
        value={String(currentInterval)}
        onValueChange={(value) => handleIntervalChange(Number(value))}
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
