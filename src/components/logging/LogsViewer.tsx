"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
import { SessionLogsTable } from "./SessionLogsTable";
import { DataSourceBadge } from "@/components/ui/data-source-badge";
import { RefreshControl } from "@/components/monitoring/refresh-control";
import { useIncrementalData } from "@/lib/hooks/use-incremental-data";
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

const SESSION_EVENTS = ["All", "LoginSuccess", "LoginFailure", "Logout"];

// Calculate time range start
function getMinTime(range: TimeRange): string | undefined {
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
}

interface LogsViewerProps {
  source?: "text_log" | "crash_log" | "session_log";
}

export function LogsViewer({ source = "text_log" }: LogsViewerProps) {
  // Filters
  const [search, setSearch] = useState("");
  const [component, setComponent] = useState("");
  const [level, setLevel] = useState<LogLevel>("All");
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  const [refreshInterval, setRefreshInterval] = useState(0);

  // Memoize fetch params
  const fetchParams = useMemo(
    () => ({
      search,
      component,
      level,
      minTime: getMinTime(timeRange),
      source,
    }),
    [search, component, level, timeRange, source]
  );

  // Fetch function for the hook
  const fetchLogs = useCallback(
    async (params: typeof fetchParams & { sinceTimestamp?: string }) => {
      const urlParams = new URLSearchParams();
      urlParams.set("limit", "1000");
      urlParams.set("source", params.source);

      if (params.search) urlParams.set("search", params.search);
      if (params.component) urlParams.set("component", params.component);
      // Level filter (text_log) or Event Type filter (session_log)
      if (
        (params.source === "text_log" || params.source === "session_log") &&
        params.level &&
        params.level !== "All"
      )
        urlParams.set("level", params.level);

      // Use sinceTimestamp for incremental, minTime for full reload
      if (params.sinceTimestamp) {
        urlParams.set("minTime", params.sinceTimestamp);
      } else if (params.minTime) {
        urlParams.set("minTime", params.minTime);
      }

      const response = await fetch(
        `/api/clickhouse/logging?${urlParams.toString()}`
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch logs");
      }

      return (result.data?.data || []) as LogEntry[];
    },
    []
  );

  // Use the shared incremental data hook
  const {
    data: logs,
    isLoading,
    error,
    reload,
    fetchNew,
    newestTimestamp,
  } = useIncrementalData(
    {
      fetchFn: fetchLogs,
      getTimestamp: (log) => log.timestamp,
      getKey: (log) =>
        `${log.timestamp}_${log.component}_${log.message.slice(0, 50)}`,
    },
    fetchParams
  );

  // Initial load
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]); // Reload when source changes

  // Handle filter apply - do full reload
  const handleApplyFilters = (e?: React.FormEvent) => {
    e?.preventDefault();
    reload();
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div />{" "}
        {/* Spacer for title if needed or just remove justified-between */}
        <RefreshControl
          interval={refreshInterval}
          onIntervalChange={setRefreshInterval}
          onRefresh={fetchNew}
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

        {/* Event Type Filter - for session_log */}
        {source === "session_log" && (
          <Select value={level} onValueChange={(v) => setLevel(v as LogLevel)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              {SESSION_EVENTS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e === "All" ? "All Events" : e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Level Filter - only for text_log */}
        {source === "text_log" && (
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
        )}

        {/* Component Input */}
        <Input
          placeholder={source === "session_log" ? "User..." : "Component..."}
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
      {source === "session_log" ? (
        <SessionLogsTable
          logs={logs}
          isLoading={isLoading && logs.length === 0}
        />
      ) : (
        <SystemLogsTable
          logs={logs}
          isLoading={isLoading && logs.length === 0}
        />
      )}

      {/* Stats */}
      <div className="text-xs text-muted-foreground">
        Showing {logs.length} logs
        {newestTimestamp &&
          ` • Latest: ${new Date(newestTimestamp).toLocaleTimeString()}`}
      </div>

      <DataSourceBadge
        sources={[
          source === "text_log"
            ? "system.text_log"
            : source === "crash_log"
            ? "system.crash_log"
            : "system.session_log",
        ]}
        description={
          source === "text_log"
            ? "Contains general server logs."
            : source === "crash_log"
            ? "Contains server crash logs. The table does not exist in the database by default, it is created only when fatal errors occur."
            : "Contains information about all successful and failed login and logout events."
        }
      />
    </div>
  );
}
