"use client";

import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  GitMerge,
  Scissors,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { StatCard } from "@/components/monitoring";
import { StatusBadge } from "@/components/monitoring";
import {
  useOperations,
  formatBytes,
  formatDuration,
} from "@/lib/hooks/use-monitoring";
import type { MergeInfo, MutationInfo } from "@/lib/clickhouse/monitoring";
import { TruncatedCell } from "@/components/monitoring";
import { DataSourceBadge } from "@/components/ui/data-source-badge";
import { VirtualizedDataTable } from "@/components/logging/VirtualizedDataTable";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Progress bar component
function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={`h-2 w-full bg-muted rounded-full overflow-hidden ${className}`}
    >
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

interface OperationsTabProps {
  refreshInterval?: number;
}

export function OperationsTab({ refreshInterval = 10000 }: OperationsTabProps) {
  const { data, isLoading, error } = useOperations({
    refreshInterval,
  });

  // Sorting state for Merges
  const [mergeSort, setMergeSort] = useState<{
    col: string;
    dir: "asc" | "desc" | null;
  }>({ col: "elapsed", dir: "desc" });
  // Sorting state for Mutations
  const [mutationSort, setMutationSort] = useState<{
    col: string;
    dir: "asc" | "desc" | null;
  }>({ col: "createTime", dir: "desc" });

  const updateMergeSort = (col: string, dir: "asc" | "desc" | null) =>
    setMergeSort({ col, dir });
  const updateMutationSort = (col: string, dir: "asc" | "desc" | null) =>
    setMutationSort({ col, dir });

  const merges = data?.merges;
  const mutations = data?.mutations;

  const sortedMerges = useMemo(() => {
    if (!merges) return [];
    return [...merges].sort((a, b) => {
      if (!mergeSort.dir) return 0;
      const aVal = a[mergeSort.col as keyof typeof a];
      const bVal = b[mergeSort.col as keyof typeof b];
      if (aVal === bVal) return 0;
      const cmp = (aVal ?? 0) < (bVal ?? 0) ? -1 : 1;
      return mergeSort.dir === "asc" ? cmp : -cmp;
    });
  }, [merges, mergeSort]);

  const sortedMutations = useMemo(() => {
    if (!mutations) return [];
    return [...mutations].sort((a, b) => {
      if (!mutationSort.dir) return 0;
      const aVal = a[mutationSort.col as keyof typeof a];
      const bVal = b[mutationSort.col as keyof typeof b];
      if (aVal === bVal) return 0;
      // Handle strings safely
      if (typeof aVal === "string" && typeof bVal === "string") {
        return mutationSort.dir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const cmp = (aVal ?? 0) < (bVal ?? 0) ? -1 : 1;
      return mutationSort.dir === "asc" ? cmp : -cmp;
    });
  }, [mutations, mutationSort]);

  /* Helper to render sortable headers */
  const renderSortableHeader = (
    label: string,
    column: string,
    currentSort: { col: string; dir: "asc" | "desc" | null },
    onUpdateSort: (col: string, dir: "asc" | "desc" | null) => void,
    align: "left" | "center" | "right" = "left",
  ) => {
    const isSorted = currentSort.col === column;
    const isAsc = currentSort.dir === "asc";
    const isDesc = currentSort.dir === "desc";

    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "-ml-3 h-8 data-[state=open]:bg-accent",
          align === "right" ? "ml-auto" : "",
          align === "center" ? "mx-auto" : "",
        )}
        onClick={() => {
          if (isAsc) onUpdateSort(column, "desc");
          else if (isDesc) onUpdateSort(column, null);
          else onUpdateSort(column, "asc");
        }}
      >
        <span>{label}</span>
        {isSorted && isAsc && <ArrowUp className="ml-2 h-4 w-4" />}
        {isSorted && isDesc && <ArrowDown className="ml-2 h-4 w-4" />}
        {!isSorted && <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />}
      </Button>
    );
  };

  const mergeColumns = useMemo(
    () => [
      {
        header: renderSortableHeader(
          "Database.Table",
          "table",
          mergeSort,
          updateMergeSort,
        ),
        width: 200,
        cell: (m: MergeInfo) => (
          <div className="font-medium">
            <TruncatedCell value={`${m.database}.${m.table}`} maxWidth={200} />
          </div>
        ),
      },
      {
        header: renderSortableHeader(
          "Result Part",
          "resultPartName",
          mergeSort,
          updateMergeSort,
        ),
        width: 150,
        cell: (m: MergeInfo) => (
          <TruncatedCell
            value={m.resultPartName}
            maxWidth={150}
            className="text-muted-foreground"
          />
        ),
      },
      {
        header: renderSortableHeader(
          "Parts",
          "numParts",
          mergeSort,
          updateMergeSort,
          "center",
        ),
        width: 80,
        className: "text-center",
        cell: (m: MergeInfo) => <div className="text-center">{m.numParts}</div>,
      },
      {
        header: renderSortableHeader(
          "Progress",
          "progress",
          mergeSort,
          updateMergeSort,
        ),
        width: 150,
        cell: (m: MergeInfo) => (
          <div className="flex items-center gap-2">
            <ProgressBar value={m.progress * 100} className="flex-1 h-2" />
            <span className="text-[10px] font-mono w-10 text-right">
              {Math.round(m.progress * 100)}%
            </span>
          </div>
        ),
      },
      {
        header: renderSortableHeader(
          "Elapsed",
          "elapsed",
          mergeSort,
          updateMergeSort,
          "right",
        ),
        width: 100,
        className: "text-right",
        cell: (m: MergeInfo) => (
          <div className="text-right">{formatDuration(m.elapsed * 1000)}</div>
        ),
      },
      {
        header: renderSortableHeader(
          "Size",
          "totalSizeBytesCompressed",
          mergeSort,
          updateMergeSort,
          "right",
        ),
        width: 100,
        className: "text-right",
        cell: (m: MergeInfo) => (
          <div className="text-right">
            {formatBytes(m.totalSizeBytesCompressed)}
          </div>
        ),
      },
      {
        header: renderSortableHeader(
          "Memory",
          "memoryUsage",
          mergeSort,
          updateMergeSort,
          "right",
        ),
        width: 100,
        className: "text-right",
        cell: (m: MergeInfo) => (
          <div className="text-right">{formatBytes(m.memoryUsage)}</div>
        ),
      },
    ],
    [mergeSort],
  );

  const mutationColumns = useMemo(
    () => [
      {
        header: renderSortableHeader(
          "Database.Table",
          "table",
          mutationSort,
          updateMutationSort,
        ),
        width: 200,
        cell: (m: MutationInfo) => (
          <div className="font-medium">
            <TruncatedCell value={`${m.database}.${m.table}`} maxWidth={200} />
          </div>
        ),
      },
      {
        header: renderSortableHeader(
          "Mutation ID",
          "mutationId",
          mutationSort,
          updateMutationSort,
        ),
        width: 150,
        cell: (m: MutationInfo) => (
          <TruncatedCell value={m.mutationId} maxWidth={120} />
        ),
      },
      {
        header: renderSortableHeader(
          "Command",
          "command",
          mutationSort,
          updateMutationSort,
        ),
        width: 200,
        cell: (m: MutationInfo) => (
          <TruncatedCell
            value={m.command}
            maxWidth={200}
            className="text-muted-foreground"
          />
        ),
      },
      {
        header: renderSortableHeader(
          "Parts To Do",
          "partsToDo",
          mutationSort,
          updateMutationSort,
          "center",
        ),
        width: 100,
        className: "text-center",
        cell: (m: MutationInfo) => (
          <div className="text-center">{m.partsToDo}</div>
        ),
      },
      {
        header: "Status",
        width: 100,
        className: "text-center",
        cell: (m: MutationInfo) => (
          <div className="flex justify-center">
            {m.latestFailReason ? (
              <StatusBadge status="critical" label="Failed" size="sm" />
            ) : (
              <StatusBadge status="ok" label="Running" size="sm" />
            )}
          </div>
        ),
      },
      {
        header: renderSortableHeader(
          "Created",
          "createTime",
          mutationSort,
          updateMutationSort,
        ),
        width: 150,
        cell: (m: MutationInfo) => (
          <div className="text-muted-foreground">{m.createTime}</div>
        ),
      },
    ],
    [mutationSort],
  );

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        <AlertCircle className="w-5 h-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  const hasActiveMerges = data && data.merges.length > 0;
  const hasActiveMutations = data && data.mutations.length > 0;
  const noOperations = !isLoading && !hasActiveMerges && !hasActiveMutations;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Active Merges"
          value={data?.mergeSummary.activeMerges ?? "-"}
          icon={GitMerge}
          loading={isLoading}
        />
        <StatCard
          title="Merge Progress"
          value={
            data
              ? `${Math.round((data.mergeSummary.avgProgress || 0) * 100)}%`
              : "-"
          }
          description={
            data && data.mergeSummary.totalBytesProcessing > 0
              ? `Processing ${formatBytes(
                  data.mergeSummary.totalBytesProcessing,
                )}`
              : undefined
          }
          loading={isLoading}
        />
        <StatCard
          title="Active Mutations"
          value={data?.mutationSummary.activeMutations ?? "-"}
          icon={Scissors}
          loading={isLoading}
        />
        <StatCard
          title="Failed Mutations"
          value={data?.mutationSummary.failedMutations ?? "-"}
          status={
            data && data.mutationSummary.failedMutations > 0 ? "critical" : "ok"
          }
          loading={isLoading}
        />
      </div>

      {/* No operations message */}
      {noOperations && (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-card">
          <Loader2 className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Active Operations</h3>
          <p className="text-muted-foreground max-w-md">
            There are no active merges or mutations running at the moment.
            Background operations will appear here when ClickHouse is processing
            data.
          </p>
        </div>
      )}

      {/* Active Merges */}
      {hasActiveMerges && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <GitMerge className="w-5 h-5" />
            Active Merges
          </h3>
          <div className="h-[400px]">
            <VirtualizedDataTable
              data={sortedMerges}
              columns={mergeColumns}
              estimateRowHeight={50}
              emptyMessage="No active merges"
              isLoading={isLoading}
            />
          </div>
        </div>
      )}

      {/* Active Mutations */}
      {hasActiveMutations && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Scissors className="w-5 h-5" />
            Active Mutations
          </h3>
          <div className="h-[400px]">
            <VirtualizedDataTable
              data={sortedMutations}
              columns={mutationColumns}
              estimateRowHeight={50}
              emptyMessage="No active mutations"
              isLoading={isLoading}
            />
          </div>

          {/* Show failed mutation details */}
          {data?.mutations.some((m) => m.latestFailReason) && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <h4 className="text-sm font-medium text-destructive mb-2">
                Failed Mutations
              </h4>
              {data.mutations
                .filter((m) => m.latestFailReason)
                .map((m, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-mono">
                      {m.database}.{m.table}
                    </span>
                    : {m.latestFailReason}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <DataSourceBadge
        sources={["system.merges", "system.mutations"]}
        description="Merges combine smaller parts into larger ones for efficient storage. Mutations are ALTER TABLE operations that modify data."
      />
    </div>
  );
}
