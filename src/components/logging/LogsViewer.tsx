"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { SystemLogsTable } from "./SystemLogsTable";
import { RefreshControl } from "@/components/monitoring/refresh-control";
import type { LogEntry } from "@/lib/hooks/use-logs";

type TimeRange = "5m" | "15m" | "1h" | "6h" | "12h" | "24h" | "7d" | "all";
type LogLevel =
  | "All"
  | "Fatal"
  | "Error"
  | "Warning"
  | "Information"
  | "Debug"
  | "Trace";

const LOG_LEVELS: LogLevel[] = [
  "All",
  "Fatal",
  "Error",
  "Warning",
  "Information",
  "Debug",
  "Trace",
];

export function LogsViewer() {
  // Filters
  const [search, setSearch] = useState("");
  const [component, setComponent] = useState("");
  const [level, setLevel] = useState<LogLevel>("All");
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  const [refreshInterval, setRefreshInterval] = useState(0);

  // Data state - accumulated logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the newest timestamp we have for incremental fetching
  const newestTimestamp = useRef<string | null>(null);

  // Calculate time range start
  const getMinTime = useCallback((range: TimeRange): string | undefined => {
    if (range === "all") return undefined;
    const now = new Date();
    switch (range) {
      case "5m":
        now.setMinutes(now.getMinutes() - 5);
        break;
      case "15m":
        now.setMinutes(now.getMinutes() - 15);
        break;
      case "1h":
        now.setHours(now.getHours() - 1);
        break;
      case "6h":
        now.setHours(now.getHours() - 6);
        break;
      case "12h":
        now.setHours(now.getHours() - 12);
        break;
      case "24h":
        now.setHours(now.getHours() - 24);
        break;
      case "7d":
        now.setDate(now.getDate() - 7);
        break;
    }
    return now.toISOString();
  }, []);

  // Build query params
  const buildParams = useCallback(
    (sinceTimestamp?: string | null) => {
      const params = new URLSearchParams();
      params.set("limit", "1000");
      if (search) params.set("search", search);
      if (component) params.set("component", component);
      if (level !== "All") params.set("level", level);

      // If incremental fetch, use sinceTimestamp; otherwise use time range
      if (sinceTimestamp) {
        params.set("minTime", sinceTimestamp);
      } else {
        const minTime = getMinTime(timeRange);
        if (minTime) params.set("minTime", minTime);
      }

      return params;
    },
    [search, component, level, timeRange, getMinTime]
  );

  // Full fetch - clears existing data and loads fresh
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = buildParams();
      const response = await fetch(
        `/api/clickhouse/logging?${params.toString()}`
      );
      const result = await response.json();

      if (result.success && result.data?.data) {
        const newLogs = result.data.data as LogEntry[];
        setLogs(newLogs);

        // Track newest timestamp for incremental refresh
        if (newLogs.length > 0) {
          newestTimestamp.current = newLogs[0].timestamp;
        }
      } else {
        setError(result.error || "Failed to fetch logs");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [buildParams]);

  // Incremental fetch - appends new data only
  const fetchNewLogs = useCallback(async () => {
    if (!newestTimestamp.current) {
      // No existing data, do a full fetch
      return fetchLogs();
    }

    setIsLoading(true);

    try {
      const params = buildParams(newestTimestamp.current);
      const response = await fetch(
        `/api/clickhouse/logging?${params.toString()}`
      );
      const result = await response.json();

      if (result.success && result.data?.data) {
        const newLogs = result.data.data as LogEntry[];

        if (newLogs.length > 0) {
          // Prepend new logs (they are newer)
          setLogs((prev) => {
            // Filter out duplicates by timestamp
            const existingTimestamps = new Set(prev.map((l) => l.timestamp));
            const uniqueNewLogs = newLogs.filter(
              (l) => !existingTimestamps.has(l.timestamp)
            );
            return [...uniqueNewLogs, ...prev];
          });

          // Update newest timestamp
          newestTimestamp.current = newLogs[0].timestamp;
        }
      }
    } catch (err) {
      console.error("Failed to fetch new logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [buildParams, fetchLogs]);

  // Handle refresh from RefreshControl
  const handleRefresh = useCallback(() => {
    fetchNewLogs();
  }, [fetchNewLogs]);

  // Handle filter changes - do full reload
  const handleApplyFilters = (e?: React.FormEvent) => {
    e?.preventDefault();
    newestTimestamp.current = null; // Reset for fresh fetch
    fetchLogs();
  };

  // Initial load
  useMemo(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">System Logs</h2>
        <RefreshControl
          interval={refreshInterval}
          onIntervalChange={setRefreshInterval}
          onRefresh={handleRefresh}
          isLoading={isLoading}
          intervals={[5, 10, 30, 60]}
        />
      </div>

      {/* Filters */}
      <form
        onSubmit={handleApplyFilters}
        className="flex flex-wrap items-center gap-2"
      >
        {/* Time Range */}
        <Select
          value={timeRange}
          onValueChange={(v) => setTimeRange(v as TimeRange)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5m">Last 5 min</SelectItem>
            <SelectItem value="15m">Last 15 min</SelectItem>
            <SelectItem value="1h">Last 1 hour</SelectItem>
            <SelectItem value="6h">Last 6 hours</SelectItem>
            <SelectItem value="12h">Last 12 hours</SelectItem>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>

        {/* Level Filter */}
        <Select value={level} onValueChange={(v) => setLevel(v as LogLevel)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            {LOG_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {l === "All" ? "All Levels" : l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Component Input */}
        <Input
          placeholder="Component..."
          value={component}
          onChange={(e) => setComponent(e.target.value)}
          className="w-[150px]"
        />

        {/* Message Search */}
        <div className="relative flex-1 max-w-[300px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {/* Error Display */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
          {error}
        </div>
      )}

      {/* Logs Table */}
      <div className="flex-1 border rounded-md overflow-hidden relative">
        <div className="absolute inset-0 overflow-auto">
          <SystemLogsTable
            logs={logs}
            isLoading={isLoading && logs.length === 0}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="text-xs text-muted-foreground">
        Showing {logs.length} logs
        {newestTimestamp.current && ` • Latest: ${newestTimestamp.current}`}
      </div>
    </div>
  );
}
