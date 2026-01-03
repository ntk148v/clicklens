"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  ClusterOverview,
  MetricsResponse,
  ReplicaStatus,
  ReplicaSummary,
  OperationsResponse,
  HealthSummary,
  MonitoringApiResponse,
  DiskInfo,
} from "@/lib/clickhouse/monitoring";

// =============================================================================
// Generic fetcher hook
// =============================================================================

interface UseMonitoringDataOptions {
  refreshInterval?: number; // in milliseconds, 0 = no auto-refresh
  enabled?: boolean;
}

interface UseMonitoringDataResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
}

function useMonitoringData<T>(
  endpoint: string,
  options: UseMonitoringDataOptions = {}
): UseMonitoringDataResult<T> {
  const { refreshInterval = 0, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(endpoint);
      const result: MonitoringApiResponse<T> = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setLastUpdated(new Date());
      } else if (result.error) {
        setError(result.error.userMessage || result.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0 || !enabled) return;

    const interval = window.setInterval(fetchData, refreshInterval);
    return () => window.clearInterval(interval);
  }, [refreshInterval, fetchData, enabled]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
    lastUpdated,
  };
}

// =============================================================================
// Specific monitoring hooks
// =============================================================================

export function useClusterOverview(options?: UseMonitoringDataOptions) {
  return useMonitoringData<ClusterOverview>(
    "/api/clickhouse/monitoring/overview",
    options
  );
}

export function useMetrics(
  params?: { category?: string; type?: string },
  options?: UseMonitoringDataOptions
) {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.type) searchParams.set("type", params.type);

  const queryString = searchParams.toString();
  const endpoint = `/api/clickhouse/monitoring/metrics${queryString ? `?${queryString}` : ""}`;

  return useMonitoringData<MetricsResponse>(endpoint, options);
}

export interface ReplicasData {
  replicas: ReplicaStatus[];
  summary: ReplicaSummary;
}

export function useReplicas(options?: UseMonitoringDataOptions) {
  return useMonitoringData<ReplicasData>(
    "/api/clickhouse/monitoring/replicas",
    options
  );
}

export function useOperations(options?: UseMonitoringDataOptions) {
  return useMonitoringData<OperationsResponse>(
    "/api/clickhouse/monitoring/operations",
    options
  );
}

export function useHealthChecks(options?: UseMonitoringDataOptions) {
  return useMonitoringData<HealthSummary>(
    "/api/clickhouse/monitoring/health",
    options
  );
}

// Disks data type
export interface DisksData {
  disks: DiskInfo[];
  summary: {
    totalDisks: number;
    totalSpace: number;
    totalUsed: number;
    totalFree: number;
    overallUsedPercentage: number;
  };
}

export function useDisks(options?: UseMonitoringDataOptions) {
  return useMonitoringData<DisksData>(
    "/api/clickhouse/monitoring/disks",
    options
  );
}

// =============================================================================
// Utility hooks
// =============================================================================

/**
 * Hook for managing auto-refresh state
 */
export function useAutoRefresh(defaultInterval: number = 30000) {
  const [interval, setIntervalValue] = useState(defaultInterval);
  const [isPaused, setIsPaused] = useState(false);

  const effectiveInterval = isPaused ? 0 : interval;

  return {
    interval: effectiveInterval,
    setInterval: setIntervalValue,
    isPaused,
    togglePause: () => setIsPaused((p) => !p),
    pause: () => setIsPaused(true),
    resume: () => setIsPaused(false),
  };
}

// =============================================================================
// Format utilities
// =============================================================================

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 0 || !isFinite(bytes)) return "-";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatNumber(num: number): string {
  if (num == null || !isFinite(num)) return "0";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
