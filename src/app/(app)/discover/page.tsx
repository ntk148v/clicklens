"use client";

import { useState, useMemo, useEffect } from "react";
import { DiscoverHistogram } from "@/components/discover/DiscoverHistogram";
import { DiscoverGrid } from "@/components/discover/DiscoverGrid";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, SlidersHorizontal, FilterX } from "lucide-react";
import { useIncrementalData } from "@/lib/hooks/use-incremental-data";
import type { LogEntry } from "@/lib/hooks/use-logs";
import { VisibilityState } from "@tanstack/react-table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

type TimeRange = "5m" | "15m" | "1h" | "6h" | "12h" | "24h" | "7d";

// Logic for calculating minTime
function getMinTime(range: TimeRange): string {
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

export default function DiscoverPage() {
  // State
  const [source, setSource] = useState("text_log");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  // Explicit minTime overrides timeRange if set (e.g. via brush/click)
  const [customMinTime, setCustomMinTime] = useState<string | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<VisibilityState>({
    source_file: false,
    thread_name: false,
    query_id: false,
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Derived fetch params
  const activeMinTime = useMemo(
    () => customMinTime || getMinTime(timeRange),
    [timeRange, customMinTime]
  );

  const fetchParams = useMemo(
    () => ({
      source,
      search: debouncedSearch,
      minTime: activeMinTime,
    }),
    [source, debouncedSearch, activeMinTime]
  );

  // 1. Fetch Logs (Incremental)
  const {
    data: logs,
    isLoading: logsLoading,
    reload: reloadLogs,
    fetchNew: fetchMoreLogs,
  } = useIncrementalData<LogEntry>(
    {
      fetchFn: async (params) => {
        const query = new URLSearchParams({
          source: params.source as string,
          search: (params.search as string) || "",
          minTime: params.minTime as string,
          limit: "1000",
          mode: "logs",
        });
        if (params.sinceTimestamp) query.set("minTime", params.sinceTimestamp);

        const res = await fetch(`/api/clickhouse/discover?${query}`);
        const json = await res.json();
        return (json.data?.data || []) as LogEntry[];
      },
      getTimestamp: (l) => l.timestamp,
      getKey: (l) => `${l.timestamp}_${l.message.slice(0, 20)}`,
    },
    fetchParams
  );

  // 2. Fetch Histogram (Full reload on filter change)
  const [histogramData, setHistogramData] = useState<
    { time: string; count: number }[]
  >([]);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadHistogram = async () => {
      setHistLoading(true);
      try {
        const query = new URLSearchParams({
          source: fetchParams.source,
          search: fetchParams.search,
          minTime: fetchParams.minTime,
          mode: "histogram",
        });
        const res = await fetch(`/api/clickhouse/discover?${query}`);
        const json = await res.json();
        if (mounted && json.success) {
          setHistogramData(json.data);
        }
      } finally {
        if (mounted) setHistLoading(false);
      }
    };
    loadHistogram();
    return () => {
      mounted = false;
    };
  }, [fetchParams.source, fetchParams.search, fetchParams.minTime]);

  // Effects
  useEffect(() => {
    reloadLogs(); // Reload logs when base filters change
  }, [fetchParams, reloadLogs]);

  return (
    <div className="h-full flex flex-col space-y-4 p-4">
      {/* Header / Top Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">Discover</h1>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text_log">System Logs</SelectItem>
              <SelectItem value="query_log">Query Log (Future)</SelectItem>
              <SelectItem value="error_log">Error Log (Future)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-[300px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select
            value={timeRange}
            onValueChange={(v: string) => {
              setTimeRange(v as TimeRange);
              setCustomMinTime(null); // Reset manual zoom
            }}
          >
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">Last 5 min</SelectItem>
              <SelectItem value="15m">Last 15 min</SelectItem>
              <SelectItem value="1h">Last 1 hour</SelectItem>
              <SelectItem value="6h">Last 6 hours</SelectItem>
              <SelectItem value="12h">Last 12 hours</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={reloadLogs}
          >
            <RefreshCw
              className={`h-4 w-4 ${logsLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Histogram */}
      <div className="border rounded-md p-4 bg-card shadow-sm relative">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Log Volume
          </h3>
          {customMinTime && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCustomMinTime(null)}
              className="h-6 text-xs"
            >
              <FilterX className="mr-1 h-3 w-3" />
              Reset Zoom
            </Button>
          )}
        </div>
        <DiscoverHistogram
          data={histogramData}
          isLoading={histLoading}
          onBarClick={(time) => setCustomMinTime(time)} // Simple "zoom to start of this bucket"
        />
      </div>

      {/* Grid Controls (Fields) */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        {/* Left Sidebar: Fields */}
        <div className="hidden md:flex flex-col w-56 border rounded-md bg-card p-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Available Fields</h3>
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-2 overflow-y-auto max-h-[500px]">
            {/* Hardcoded field list for now, could be dynamic */}
            {[
              { id: "type", label: "Level" },
              { id: "component", label: "Component" },
              { id: "message", label: "Message" },
              { id: "thread_name", label: "Thread" },
              { id: "query_id", label: "Query ID" },
              { id: "source_file", label: "Source File" },
            ].map((field) => (
              <div key={field.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`field-${field.id}`}
                  checked={visibleColumns[field.id] !== false}
                  onCheckedChange={(checked: boolean | "indeterminate") => {
                    setVisibleColumns((prev) => ({
                      ...prev,
                      [field.id]: !!checked,
                    }));
                  }}
                />
                <Label
                  htmlFor={`field-${field.id}`}
                  className="text-sm font-normal truncate cursor-pointer"
                >
                  {field.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Main Grid */}
        <div className="flex-1 flex flex-col min-h-0 bg-card border rounded-md shadow-sm overflow-hidden">
          <div className="p-2 border-b text-xs text-muted-foreground flex justify-between">
            <span>{logs.length} events loaded</span>
            {/* Mobile Field Toggle could go here */}
          </div>
          <div className="flex-1 overflow-auto">
            <DiscoverGrid
              logs={logs}
              isLoading={logsLoading && logs.length === 0}
              visibleColumns={visibleColumns}
              onVisibleColumnsChange={setVisibleColumns}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
