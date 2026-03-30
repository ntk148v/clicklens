"use client";

import { useCallback } from "react";
import { QueryCancellationManager } from "@/lib/clickhouse/cancellation";
import type { HistogramDataPoint } from "@/stores/discover/data-store";

export interface FetchHistogramParams {
  selectedDatabase: string;
  selectedTable: string;
  selectedTimeColumn: string;
  activeMinTime: string | undefined;
  activeMaxTime: string | undefined;
  appliedFilter: string;
}

export interface UseDiscoverHistogramOptions {
  cancellationManager: QueryCancellationManager;
  onHistogramDataReceived: (data: HistogramDataPoint[]) => void;
  onLoadingChange: (loading: boolean) => void;
}

export interface UseDiscoverHistogramReturn {
  fetchHistogram: (params: FetchHistogramParams) => Promise<void>;
  cancelHistogram: () => void;
}

/**
 * Hook for managing histogram data fetching
 * Handles query cancellation and histogram data updates
 */
export function useDiscoverHistogram(options: UseDiscoverHistogramOptions): UseDiscoverHistogramReturn {
  const { cancellationManager, onHistogramDataReceived, onLoadingChange } = options;

  const fetchHistogram = useCallback(
    async (params: FetchHistogramParams) => {
      const {
        selectedDatabase,
        selectedTable,
        selectedTimeColumn,
        activeMinTime,
        activeMaxTime,
        appliedFilter,
      } = params;

      if (!selectedDatabase || !selectedTable || !selectedTimeColumn) {
        onHistogramDataReceived([]);
        return;
      }

      const queryId = `hist-${selectedDatabase}-${selectedTable}-${selectedTimeColumn}`;
      const controller = cancellationManager.createController(queryId);

      onLoadingChange(true);

      try {
        const urlParams = new URLSearchParams({
          database: selectedDatabase,
          table: selectedTable,
          mode: "histogram",
          timeColumn: selectedTimeColumn,
        });

        if (activeMinTime) urlParams.set("minTime", activeMinTime);
        if (activeMaxTime) urlParams.set("maxTime", activeMaxTime);
        if (appliedFilter.trim()) urlParams.set("filter", appliedFilter.trim());

        const res = await fetch(`/api/clickhouse/discover?${urlParams}`, {
          signal: controller.signal,
        });
        const data = await res.json();

        if (data.success && data.histogram) {
          onHistogramDataReceived(data.histogram);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch histogram:", err);
      } finally {
        if (!controller.signal.aborted) {
          onLoadingChange(false);
        }
      }
    },
    [cancellationManager, onHistogramDataReceived, onLoadingChange]
  );

  const cancelHistogram = useCallback(() => {
    cancellationManager.cancelAll();
    onLoadingChange(false);
  }, [cancellationManager, onLoadingChange]);

  return {
    fetchHistogram,
    cancelHistogram,
  };
}
