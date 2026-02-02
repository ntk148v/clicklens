"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchClient } from "@/lib/api/client";

// Types
import type { TableOverview } from "@/app/api/clickhouse/tables/explorer/route";
import type { PartInfo } from "@/app/api/clickhouse/tables/explorer/parts/route";
import type { ColumnStats } from "@/app/api/clickhouse/tables/explorer/columns/route";
import type { ReplicaInfo } from "@/app/api/clickhouse/tables/explorer/replicas/route";
import type { MutationInfo } from "@/app/api/clickhouse/tables/explorer/mutations/route";
import type { MergeInfo } from "@/app/api/clickhouse/tables/explorer/merges/route";

// =============================================================================
// Generic fetcher hook
// =============================================================================

interface UseTableExplorerDataOptions {
  enabled?: boolean;
}

interface UseTableExplorerDataResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function useTableExplorerData<T>(
  endpoint: string,
  options: UseTableExplorerDataOptions = {},
): UseTableExplorerDataResult<T> {
  const { enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await fetchClient<T>(endpoint);

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

// =============================================================================
// Table Explorer Hooks
// =============================================================================

export function useTableOverview(
  database: string | null,
  table: string | null,
) {
  const endpoint =
    database && table
      ? `/api/clickhouse/tables/explorer?database=${encodeURIComponent(
          database,
        )}&table=${encodeURIComponent(table)}`
      : "";

  return useTableExplorerData<TableOverview>(endpoint, {
    enabled: !!database && !!table,
  });
}

export interface PartsData {
  parts: PartInfo[];
  summary: {
    total_parts: number;
    total_rows: number;
    total_bytes: number;
    total_compressed: number;
    total_uncompressed: number;
    avg_compression_ratio: number;
  };
}

export function useTableParts(database: string | null, table: string | null) {
  const endpoint =
    database && table
      ? `/api/clickhouse/tables/explorer/parts?database=${encodeURIComponent(
          database,
        )}&table=${encodeURIComponent(table)}`
      : "";

  return useTableExplorerData<PartsData>(endpoint, {
    enabled: !!database && !!table,
  });
}

export interface ColumnsData {
  columns: ColumnStats[];
  summary: {
    total_columns: number;
    total_bytes: number;
    total_compressed: number;
    total_uncompressed: number;
    avg_compression_ratio: number;
  };
}

export function useTableColumns(database: string | null, table: string | null) {
  const endpoint =
    database && table
      ? `/api/clickhouse/tables/explorer/columns?database=${encodeURIComponent(
          database,
        )}&table=${encodeURIComponent(table)}`
      : "";

  return useTableExplorerData<ColumnsData>(endpoint, {
    enabled: !!database && !!table,
  });
}

export interface ReplicasData {
  replica: ReplicaInfo | null;
  is_replicated: boolean;
}

export function useTableReplicas(
  database: string | null,
  table: string | null,
) {
  const endpoint =
    database && table
      ? `/api/clickhouse/tables/explorer/replicas?database=${encodeURIComponent(
          database,
        )}&table=${encodeURIComponent(table)}`
      : "";

  return useTableExplorerData<ReplicasData>(endpoint, {
    enabled: !!database && !!table,
  });
}

export interface MutationsData {
  mutations: MutationInfo[];
  summary: {
    total: number;
    pending: number;
    completed: number;
    failed: number;
  };
}

export function useTableMutations(
  database: string | null,
  table: string | null,
) {
  const endpoint =
    database && table
      ? `/api/clickhouse/tables/explorer/mutations?database=${encodeURIComponent(
          database,
        )}&table=${encodeURIComponent(table)}`
      : "";

  return useTableExplorerData<MutationsData>(endpoint, {
    enabled: !!database && !!table,
  });
}

export interface MergesData {
  merges: MergeInfo[];
  summary: {
    active_merges: number;
    total_memory_usage: number;
    total_bytes_to_merge: number;
  };
}

export function useTableMerges(database: string | null, table: string | null) {
  const endpoint =
    database && table
      ? `/api/clickhouse/tables/explorer/merges?database=${encodeURIComponent(
          database,
        )}&table=${encodeURIComponent(table)}`
      : "";

  return useTableExplorerData<MergesData>(endpoint, {
    enabled: !!database && !!table,
  });
}

// Types for dependencies
import type {
  TableNode,
  TableEdge,
  DependencyGraph,
  EdgeType,
} from "@/app/api/clickhouse/tables/explorer/dependencies/route";

export type { TableNode, TableEdge, DependencyGraph, EdgeType };

export type DependenciesData = DependencyGraph;

export function useTableDependencies(database: string | null) {
  const endpoint = database
    ? `/api/clickhouse/tables/explorer/dependencies?database=${encodeURIComponent(database)}`
    : "";

  return useTableExplorerData<DependenciesData>(endpoint, {
    enabled: !!database,
  });
}

// Re-export types for convenience
export type {
  TableOverview,
  PartInfo,
  ColumnStats,
  ReplicaInfo,
  MutationInfo,
  MergeInfo,
};
