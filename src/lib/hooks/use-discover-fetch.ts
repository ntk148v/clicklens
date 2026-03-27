"use client";

import { useCallback } from "react";
import { toast } from "@/components/ui/use-toast";
import { parseNDJSONStream } from "@/lib/streams/ndjson-parser";
import { QueryCancellationManager } from "@/lib/clickhouse/cancellation";
import type { DiscoverRow } from "@/lib/types/discover";
import type { SortingState } from "@tanstack/react-table";

export interface FetchDataParams {
  selectedDatabase: string;
  selectedTable: string;
  selectedColumns: string[];
  selectedTimeColumn: string;
  activeMinTime: string | undefined;
  activeMaxTime: string | undefined;
  appliedFilter: string;
  sorting: SortingState;
  groupBy: string[];
  page: number;
  pageSize: number;
}

export interface UseDiscoverFetchOptions {
  cancellationManager: QueryCancellationManager;
  onRowsReceived: (rows: DiscoverRow[]) => void;
  onClearRows: () => void;
  onMetaReceived: (meta: {
    totalHits?: number;
    isApproximate?: boolean;
    accuracy?: number;
  }) => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (error: string | null) => void;
}

export interface UseDiscoverFetchReturn {
  fetchData: (params: FetchDataParams) => Promise<void>;
  cancelQuery: () => void;
}

/**
 * Hook for managing data fetching with NDJSON stream parsing
 * Handles query cancellation, streaming data, and error handling
 */
export function useDiscoverFetch(options: UseDiscoverFetchOptions): UseDiscoverFetchReturn {
  const {
    cancellationManager,
    onRowsReceived,
    onClearRows,
    onMetaReceived,
    onLoadingChange,
    onError,
  } = options;

  const fetchData = useCallback(
    async (params: FetchDataParams) => {
      const {
        selectedDatabase,
        selectedTable,
        selectedColumns,
        selectedTimeColumn,
        activeMinTime,
        activeMaxTime,
        appliedFilter,
        sorting,
        groupBy,
        page,
        pageSize,
      } = params;

      if (!selectedDatabase || !selectedTable) return;

      const queryId = `data-${selectedDatabase}-${selectedTable}-${page}-${pageSize}`;
      const controller = cancellationManager.createController(queryId);

      onLoadingChange(true);
      onError(null);
      onClearRows();

      try {
        const offset = (page - 1) * pageSize;
        const urlParams = new URLSearchParams({
          database: selectedDatabase,
          table: selectedTable,
          mode: "data",
          limit: String(pageSize),
          offset: String(offset),
        });

        if (selectedColumns.length > 0) {
          urlParams.set("columns", selectedColumns.join(","));
        }
        if (selectedTimeColumn) {
          urlParams.set("timeColumn", selectedTimeColumn);
        }
        if (activeMinTime) {
          urlParams.set("minTime", activeMinTime);
        }
        if (activeMaxTime) {
          urlParams.set("maxTime", activeMaxTime);
        }
        if (appliedFilter.trim()) {
          urlParams.set("filter", appliedFilter.trim());
        }
        if (sorting.length > 0) {
          const sortStr = sorting.map((s: SortingState[0]) => `${s.id}:${s.desc ? "desc" : "asc"}`).join(",");
          urlParams.set("orderBy", sortStr);
        }
        if (groupBy.length > 0) {
          urlParams.set("groupBy", groupBy.join(","));
        }

        const res = await fetch(`/api/clickhouse/discover?${urlParams}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          let msg = res.statusText;
          try {
            const err = await res.json();
            msg = err.error || msg;
          } catch {
            // Use status text if JSON parsing fails
          }
          throw new Error(msg);
        }

        if (!res.body) throw new Error("No response body");

        await parseNDJSONStream<DiscoverRow>(
          res.body,
          {
            onMeta: (meta: Record<string, unknown>) => {
              onMetaReceived({
                totalHits: typeof meta.totalHits === "number" ? meta.totalHits : undefined,
                isApproximate: typeof meta.isApproximate === "boolean" ? meta.isApproximate : undefined,
                accuracy: typeof meta.accuracy === "number" ? meta.accuracy : undefined,
              });
            },
            onBatch: (batch: DiscoverRow[]) => {
              onRowsReceived(batch);
            },
            onError: (errMsg: string) => {
              toast({
                variant: "destructive",
                title: "Stream Error",
                description: errMsg,
              });
            },
          },
          controller.signal,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch data";
        onError(errorMessage);
        toast({
          variant: "destructive",
          title: "Query Error",
          description: errorMessage,
        });
      } finally {
        if (!controller.signal.aborted) {
          onLoadingChange(false);
        }
      }
    },
    [cancellationManager, onRowsReceived, onMetaReceived, onLoadingChange, onError]
  );

  const cancelQuery = useCallback(() => {
    cancellationManager.cancelAll();
    onLoadingChange(false);
  }, [cancellationManager, onLoadingChange]);

  return {
    fetchData,
    cancelQuery,
  };
}
