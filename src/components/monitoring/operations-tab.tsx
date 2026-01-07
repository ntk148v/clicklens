"use client";

import { AlertCircle, GitMerge, Scissors, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useMemo } from "react";
import { StatCard } from "@/components/monitoring";
import { StatusBadge } from "@/components/monitoring";
import {
  useOperations,
  formatBytes,
  formatDuration,
} from "@/lib/hooks/use-monitoring";
import { TruncatedCell } from "@/components/monitoring";

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
  const { data, isLoading, error, refetch } = useOperations({
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

  const sortedMerges = useMemo(() => {
    if (!data?.merges) return [];
    return [...data.merges].sort((a, b) => {
      if (!mergeSort.dir) return 0;
      const aVal = (a as any)[mergeSort.col];
      const bVal = (b as any)[mergeSort.col];
      if (aVal === bVal) return 0;
      const cmp = (aVal ?? 0) < (bVal ?? 0) ? -1 : 1;
      return mergeSort.dir === "asc" ? cmp : -cmp;
    });
  }, [data?.merges, mergeSort]);

  const sortedMutations = useMemo(() => {
    if (!data?.mutations) return [];
    return [...data.mutations].sort((a, b) => {
      if (!mutationSort.dir) return 0;
      const aVal = (a as any)[mutationSort.col];
      const bVal = (b as any)[mutationSort.col];
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
  }, [data?.mutations, mutationSort]);

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
                  data.mergeSummary.totalBytesProcessing
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    currentSort={
                      mergeSort.col === "table" ? mergeSort.dir : null
                    }
                    onSort={(dir) => updateMergeSort("table", dir)}
                  >
                    Database.Table
                  </SortableTableHead>
                  <SortableTableHead
                    currentSort={
                      mergeSort.col === "resultPartName" ? mergeSort.dir : null
                    }
                    onSort={(dir) => updateMergeSort("resultPartName", dir)}
                  >
                    Result Part
                  </SortableTableHead>
                  <SortableTableHead
                    className="text-center"
                    currentSort={
                      mergeSort.col === "numParts" ? mergeSort.dir : null
                    }
                    onSort={(dir) => updateMergeSort("numParts", dir)}
                  >
                    Parts
                  </SortableTableHead>
                  <SortableTableHead
                    className="w-[150px]"
                    currentSort={
                      mergeSort.col === "progress" ? mergeSort.dir : null
                    }
                    onSort={(dir) => updateMergeSort("progress", dir)}
                  >
                    Progress
                  </SortableTableHead>
                  <SortableTableHead
                    className="text-right"
                    currentSort={
                      mergeSort.col === "elapsed" ? mergeSort.dir : null
                    }
                    onSort={(dir) => updateMergeSort("elapsed", dir)}
                  >
                    Elapsed
                  </SortableTableHead>
                  <SortableTableHead
                    className="text-right"
                    currentSort={
                      mergeSort.col === "totalSizeBytesCompressed"
                        ? mergeSort.dir
                        : null
                    }
                    onSort={(dir) =>
                      updateMergeSort("totalSizeBytesCompressed", dir)
                    }
                  >
                    Size
                  </SortableTableHead>
                  <SortableTableHead
                    className="text-right"
                    currentSort={
                      mergeSort.col === "memoryUsage" ? mergeSort.dir : null
                    }
                    onSort={(dir) => updateMergeSort("memoryUsage", dir)}
                  >
                    Memory
                  </SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMerges.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">
                      <TruncatedCell
                        value={`${m.database}.${m.table}`}
                        maxWidth={200}
                      />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell
                        value={m.resultPartName}
                        maxWidth={150}
                        className="text-muted-foreground"
                      />
                    </TableCell>
                    <TableCell className="text-center">{m.numParts}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ProgressBar
                          value={m.progress * 100}
                          className="flex-1"
                        />
                        <span className="text-xs font-mono w-10 text-right">
                          {Math.round(m.progress * 100)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatDuration(m.elapsed * 1000)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatBytes(m.totalSizeBytesCompressed)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatBytes(m.memoryUsage)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    currentSort={
                      mutationSort.col === "table" ? mutationSort.dir : null
                    }
                    onSort={(dir) => updateMutationSort("table", dir)}
                  >
                    Database.Table
                  </SortableTableHead>
                  <SortableTableHead
                    currentSort={
                      mutationSort.col === "mutationId"
                        ? mutationSort.dir
                        : null
                    }
                    onSort={(dir) => updateMutationSort("mutationId", dir)}
                  >
                    Mutation ID
                  </SortableTableHead>
                  <SortableTableHead
                    currentSort={
                      mutationSort.col === "command" ? mutationSort.dir : null
                    }
                    onSort={(dir) => updateMutationSort("command", dir)}
                  >
                    Command
                  </SortableTableHead>
                  <SortableTableHead
                    className="text-center"
                    currentSort={
                      mutationSort.col === "partsToDo" ? mutationSort.dir : null
                    }
                    onSort={(dir) => updateMutationSort("partsToDo", dir)}
                  >
                    Parts To Do
                  </SortableTableHead>
                  <SortableTableHead className="text-center" sortable={false}>
                    Status
                  </SortableTableHead>
                  <SortableTableHead
                    currentSort={
                      mutationSort.col === "createTime"
                        ? mutationSort.dir
                        : null
                    }
                    onSort={(dir) => updateMutationSort("createTime", dir)}
                  >
                    Created
                  </SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMutations.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">
                      <TruncatedCell
                        value={`${m.database}.${m.table}`}
                        maxWidth={200}
                      />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell value={m.mutationId} maxWidth={120} />
                    </TableCell>
                    <TableCell>
                      <TruncatedCell
                        value={m.command}
                        maxWidth={200}
                        className="text-muted-foreground"
                      />
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {m.partsToDo}
                    </TableCell>
                    <TableCell className="text-center">
                      {m.latestFailReason ? (
                        <StatusBadge
                          status="critical"
                          label="Failed"
                          size="sm"
                        />
                      ) : (
                        <StatusBadge status="ok" label="Running" size="sm" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.createTime}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
      <div className="p-4 rounded-lg bg-muted border">
        <p className="text-xs text-muted-foreground">
          Data sourced from <code className="text-primary">system.merges</code>{" "}
          and <code className="text-primary">system.mutations</code>. Merges
          combine smaller parts into larger ones for efficient storage.
          Mutations are ALTER TABLE operations that modify data.
        </p>
      </div>
    </div>
  );
}
