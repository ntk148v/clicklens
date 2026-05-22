"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import { fetchApi } from "@/lib/api/client";

// Types
import type { RunningQuery } from "@/app/api/clickhouse/queries/running/route";
import type { QueryHistoryEntry } from "@/app/api/clickhouse/queries/history/route";
import type { ExpensiveQuery } from "@/app/api/clickhouse/queries/analytics/route";
import type { QueryCacheEntry } from "@/app/api/clickhouse/queries/cache/route";

// =============================================================================
// Generic fetcher hook with AbortController and visibility handling
// =============================================================================

interface UseQueryDataOptions {
  enabled?: boolean;
  refreshInterval?: number;
}

interface UseQueryDataResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function useQueryData<T>(
  endpoint: string,
  options: UseQueryDataOptions = {}
): UseQueryDataResult<T> {
  const { enabled = true, refreshInterval = 0 } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    if (typeof document !== "undefined" && document.hidden) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchApi(endpoint, { signal: controller.signal });
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
      } else if (result.error) {
        setError(result.error.userMessage || result.error.message);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (refreshInterval <= 0 || !enabled) return;

    const interval = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchData();
    }, refreshInterval);
    return () => window.clearInterval(interval);
  }, [refreshInterval, fetchData, enabled]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

// =============================================================================
// Query Analytics Hooks
// =============================================================================

export function useRunningQueries(refreshInterval: number = 0) {
  return useQueryData<RunningQuery[]>("/api/clickhouse/queries/running", {
    refreshInterval,
  });
}

export interface QueryHistoryData {
  queries: QueryHistoryEntry[];
  total: number;
}

export interface QueryHistoryFilters {
  limit?: number;
  offset?: number;
  user?: string;
  minDuration?: number;
  queryType?: string;
  status?: "all" | "success" | "error";
  fingerprint?: string;
}

export function useQueryHistory(filters: QueryHistoryFilters = {}) {
  const params = new URLSearchParams();
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));
  if (filters.user) params.set("user", filters.user);
  if (filters.minDuration)
    params.set("minDuration", String(filters.minDuration));
  if (filters.queryType) params.set("queryType", filters.queryType);
  if (filters.status && filters.status !== "all")
    params.set("status", filters.status);
  if (filters.fingerprint) params.set("fingerprint", filters.fingerprint);

  const endpoint = `/api/clickhouse/queries/history?${params.toString()}`;

  return useQueryData<QueryHistoryData>(endpoint);
}

export interface QueryAnalyticsData {
  queries: ExpensiveQuery[];
  summary: {
    total_queries: number;
    total_duration_ms: number;
    total_memory: number;
    total_read_bytes: number;
    failed_queries: number;
  };
}

export function useQueryAnalytics(
  metric: "duration" | "memory" | "read_bytes" = "duration",
  limit: number = 50
) {
  const endpoint = `/api/clickhouse/queries/analytics?metric=${metric}&limit=${limit}`;
  return useQueryData<QueryAnalyticsData>(endpoint);
}

export interface QueryCacheData {
  entries: QueryCacheEntry[];
  summary: {
    total_entries: number;
    total_size: number;
    stale_count: number;
  };
  available: boolean;
}

export function useQueryCache() {
  return useQueryData<QueryCacheData>("/api/clickhouse/queries/cache");
}

// Re-export types for convenience
export type {
  RunningQuery,
  QueryHistoryEntry,
  ExpensiveQuery,
  QueryCacheEntry,
};
