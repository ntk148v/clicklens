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
import { useLogStream } from "@/lib/hooks/use-log-stream";
import { FlexibleTimeRange, TimeRange } from "@/lib/types/discover";

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

interface LogsViewerProps {
  source?: "text_log" | "crash_log" | "session_log";
  timeRange: FlexibleTimeRange;
  refreshKey?: number;
}

export function LogsViewer({
  source = "text_log",
  timeRange,
  refreshKey = 0,
}: LogsViewerProps) {
  // Filters
  const [search, setSearch] = useState("");
  const [component, setComponent] = useState("");
  const [level, setLevel] = useState<LogLevel>("All");

  // Calculate minTime from timeRange
  const minTime = useMemo(() => {
    if (timeRange.type === "absolute") {
      return timeRange.from;
    } else {
      // Relative
      const rangeKey = timeRange.from.replace("now-", "") as TimeRange;
      const now = new Date();
      // Reuse logic from discover or dup minimal logic here
      // duplicating minimal logic for safety/speed without circular deps if helper is not perfect
      // actually let's use a quick map helper inside or similar
      const mapping: Record<string, number> = {
        "5m": 5,
        "15m": 15,
        "30m": 30,
        "60m": 60,
        "1h": 60,
        "3h": 180,
        "6h": 360,
        "12h": 720,
        "24h": 1440,
        "3d": 4320,
        "7d": 10080,
      };
      const minutes = mapping[rangeKey] || 60;
      return new Date(now.getTime() - minutes * 60 * 1000).toISOString();
    }
  }, [timeRange]);

  // Memoize query params
  const queryParams = useMemo(
    () => ({
      search,
      component,
      level,
      minTime,
      source,
    }),
    [search, component, level, minTime, source],
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
  }, [source, minTime]); // Reload when source or time window changes

  // Handle external refresh trigger
  useEffect(() => {
    if (refreshKey > 0) {
      loadLive();
    }
  }, [refreshKey, loadLive]);

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
      </div>

      {/* Filters */}
      <form
        onSubmit={handleApplyFilters}
        className="flex flex-wrap items-center gap-2"
      >
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
