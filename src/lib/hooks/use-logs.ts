"use client";

import { useState, useEffect, useCallback } from "react";

// =============================================================================
// Types
// =============================================================================

export interface LogEntry {
  timestamp: string; // event_time_microseconds
  type: string; // level
  component: string; // logger_name
  message: string;
  details: string; // concatenated source info
  // Extra fields for details view
  event_time?: string;
  thread_name?: string;
  priority_str?: string;
  query_id?: string;
  source_file?: string;
  source_line?: number; // backend returns string or number? toString(source_line) in concat, but raw source_line might be number
}

export interface LogsResponse {
  data: LogEntry[];
  rows: number;
  total_rows?: number; // Approximate
}

export interface LogFilters {
  limit?: number;
  offset?: number;
  search?: string;
  level?: string;
  component?: string; // logger_name
  minTime?: string; // ISO string
  maxTime?: string; // ISO string
  mode?: "system" | "error" | "query";
}

// =============================================================================
// Hook
// =============================================================================

interface UseLogsResult {
  data: LogsResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSystemLogs(filters: LogFilters = {}): UseLogsResult {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.limit) params.set("limit", String(filters.limit));
      if (filters.offset) params.set("offset", String(filters.offset));
      if (filters.search) params.set("search", filters.search);
      if (filters.level && filters.level !== "All")
        params.set("level", filters.level);
      if (filters.component) params.set("component", filters.component);
      if (filters.minTime) params.set("minTime", filters.minTime);
      if (filters.maxTime) params.set("maxTime", filters.maxTime);
      if (filters.mode) params.set("mode", filters.mode);

      const response = await fetch(
        `/api/clickhouse/logging?${params.toString()}`
      );
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to fetch logs");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [
    filters.limit,
    filters.offset,
    filters.search,
    filters.level,
    filters.minTime,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
