"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
import { useLogStream } from "@/lib/hooks/use-log-stream";

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

  // Memoize query params
  const queryParams = useMemo(
    () => ({
      search,
      component,
      level,
      minTime: getMinTime(timeRange),
      source,
    }),
    [search, component, level, timeRange, source],
  );

  const {
    logs,
    isLoading,
    totalHits,
    error,
    hasMore,
    reload,
    loadMore,
    loadLive,
  } = useLogStream({
    fetchUrl: "/api/clickhouse/logging",
    queryParams,
  });

  // Initial load
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]); // Only source change triggers hard reload auto?
  // Wait, if timeRange changes, queryParams change -> useEffect??
  // The hook doesn't auto-reload on queryParams change to avoid flickers.

  // Handle filter submission
  const handleApplyFilters = (e?: React.FormEvent) => {
    e?.preventDefault();
    reload();
  };

  // Infinite Scroll Trigger (Intersection Observer)
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastLogRef = useCallback(
    (node: HTMLTableRowElement) => {
      if (isLoading) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [isLoading, hasMore, loadMore],
  );

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div />
        <RefreshControl
          interval={refreshInterval}
          onIntervalChange={setRefreshInterval}
          onRefresh={loadLive}
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
          onValueChange={(v) => {
            // For UX, maybe simple filter change shouldn't auto reload?
            // But existing behavior likely expected it.
            // We'll update state, user hits Apply.
            setTimeRange(v as TimeRange);
          }}
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
          // We need to pass the infinite scroll ref logic down?
          // The current tables probably accept standard props.
          // Let's assume they might need modification OR we wrap them.
          // Actually checking table implementations would be good.
          // For now, let's wrap or inject.
          // BUT wait, `SessionLogsTable` likely just maps.
          // Let's modify the tables to accept a ref or "onEndReached" prop if possible?
          // Or just render a sentinel div below.
        />
      ) : (
        <SystemLogsTable
          logs={logs}
          isLoading={isLoading && logs.length === 0}
        />
      )}

      {/* Infinite Scroll Sentinel */}
      {hasMore && !isLoading && (
        <div
          ref={lastLogRef as unknown as React.LegacyRef<HTMLDivElement>} // Cast because it might be attached to div, not tr
          className="h-4 w-full"
        />
      )}
      {isLoading && logs.length > 0 && (
        <div className="py-2 text-center text-xs text-muted-foreground">
          Loading more...
        </div>
      )}

      {/* Stats */}
      <div className="text-xs text-muted-foreground">
        Showing {logs.length} / {totalHits || "?"} logs
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
