"use client";

import { useState } from "react";
import {
  Loader2,
  Zap,
  XOctagon,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
// Table imports removed as we use VirtualizedDataTable
import { VirtualizedDataTable } from "@/components/logging/VirtualizedDataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { useRunningQueries } from "@/lib/hooks/use-query-analytics";
import { formatBytes } from "@/lib/hooks/use-monitoring";
import { TruncatedCell } from "@/components/ui/truncated-cell";
import type { RunningQuery } from "@/lib/hooks/use-query-analytics";

interface RunningTabProps {
  refreshInterval: number;
}

export function RunningTab({ refreshInterval }: RunningTabProps) {
  const { data, isLoading, error, refetch } =
    useRunningQueries(refreshInterval);
  const [killingId, setKillingId] = useState<string | null>(null);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    null,
  );

  const sortedQueries = data
    ? [...data].sort((a, b) => {
        if (!sortColumn || !sortDirection) return 0;

        const aValue = a[sortColumn as keyof RunningQuery];
        const bValue = b[sortColumn as keyof RunningQuery];

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const comparison = aValue < bValue ? -1 : 1;
        return sortDirection === "asc" ? comparison : -comparison;
      })
    : [];

  const updateSort = (column: string, direction: "asc" | "desc" | null) => {
    setSortColumn(column);
    setSortDirection(direction);
  };

  const handleKillQuery = async (queryId: string) => {
    setKillingId(queryId);
    try {
      const response = await fetch("/api/clickhouse/kill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryId }),
      });
      const result = await response.json();
      if (result.success) {
        // Refresh the list after kill
        await refetch();
      }
    } catch (err) {
      console.error("Failed to kill query:", err);
    } finally {
      setKillingId(null);
    }
  };

  /* Helper to create sortable header content */
  const renderSortableHeader = (
    label: string,
    column: string,
    align: "left" | "right" = "left",
  ) => {
    const isSorted = sortColumn === column;
    const isAsc = sortDirection === "asc";
    const isDesc = sortDirection === "desc";

    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "-ml-3 h-8 data-[state=open]:bg-accent",
          align === "right" ? "ml-auto" : "",
        )}
        onClick={() => {
          if (isAsc) updateSort(column, "desc");
          else if (isDesc) updateSort(column, null);
          else updateSort(column, "asc");
        }}
      >
        <span>{label}</span>
        {isSorted && isAsc && <ArrowUp className="ml-2 h-4 w-4" />}
        {isSorted && isDesc && <ArrowDown className="ml-2 h-4 w-4" />}
        {!isSorted && <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />}
      </Button>
    );
  };

  const columns = [
    {
      header: renderSortableHeader("Query", "query"),
      width: 300,
      cell: (query: RunningQuery) => (
        <div className="flex flex-col gap-1">
          <TruncatedCell
            value={query.query}
            maxWidth={400}
            className="bg-muted px-2 py-1 rounded"
          />
          <span className="text-xs text-muted-foreground mt-1 block">
            ID: {query.query_id.slice(0, 8)}...
          </span>
        </div>
      ),
    },
    {
      header: renderSortableHeader("User", "user"),
      width: 120,
      cell: (query: RunningQuery) => (
        <Badge variant="secondary" className="text-xs">
          {query.user}
        </Badge>
      ),
    },
    {
      header: renderSortableHeader("Elapsed", "elapsed", "right"),
      width: 100,
      className: "text-right",
      cell: (query: RunningQuery) => (
        <div className="text-right w-full">{query.elapsed.toFixed(2)}s</div>
      ),
    },
    {
      header: renderSortableHeader("Read", "read_bytes", "right"),
      width: 100,
      className: "text-right",
      cell: (query: RunningQuery) => (
        <div className="text-right w-full">{formatBytes(query.read_bytes)}</div>
      ),
    },
    {
      header: renderSortableHeader("Memory", "memory_usage", "right"),
      width: 100,
      className: "text-right",
      cell: (query: RunningQuery) => (
        <div className="text-right w-full">
          {formatBytes(query.memory_usage)}
        </div>
      ),
    },
    {
      header: "Action",
      width: 80,
      cell: (query: RunningQuery) => (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              disabled={killingId === query.query_id}
            >
              {killingId === query.query_id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <XOctagon className="h-3 w-3" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kill Query?</AlertDialogTitle>
              <AlertDialogDescription>
                This will terminate the query immediately. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleKillQuery(query.query_id)}
              >
                Kill Query
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ),
    },
  ];

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        {error}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Zap className="h-12 w-12 mb-4 opacity-50" />
        <p>No running queries</p>
        <p className="text-sm mt-2">Queries will appear here when executing</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 h-full flex flex-col">
      {/* Summary */}
      <div className="flex items-center justify-between flex-none">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            {data.length} running {data.length === 1 ? "query" : "queries"}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Virtualized Table */}
      <div className="flex-1 min-h-0">
        <VirtualizedDataTable
          data={sortedQueries}
          columns={columns}
          estimateRowHeight={60}
          emptyMessage="No running queries"
        />
      </div>
    </div>
  );
}
