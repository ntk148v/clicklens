"use client";

import { useState } from "react";
import { Loader2, Zap, XOctagon, RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useRunningQueries } from "@/lib/hooks/use-query-analytics";
import { formatBytes, formatNumber } from "@/lib/hooks/use-monitoring";
import { TruncatedCell } from "@/components/ui/truncated-cell";
import { SortableHeader, SortDirection } from "@/components/ui/sortable-header";
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
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

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

  const handleSort = (column: string, direction: SortDirection) => {
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

  if (isLoading) {
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
    <div className="space-y-4 p-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
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

      {/* Queries Table */}
      <Card className="flex-1 overflow-hidden border-none shadow-none flex flex-col">
        <div className="flex-1 border rounded-md overflow-hidden relative">
          <ScrollArea className="h-[600px]">
            <div className="min-w-max">
              <Table>
                <TableHeader className="sticky top-0 bg-secondary/90 backdrop-blur z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="min-w-[300px]">
                      <SortableHeader
                        column="query"
                        sortedColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Query
                      </SortableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        column="user"
                        sortedColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        User
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        column="elapsed"
                        sortedColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        className="ml-auto"
                      >
                        Elapsed
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        column="read_bytes"
                        sortedColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        className="ml-auto"
                      >
                        Read
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        column="memory_usage"
                        sortedColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        className="ml-auto"
                      >
                        Memory
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="w-[80px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedQueries.map((query) => (
                    <TableRow key={query.query_id}>
                      <TableCell>
                        <TruncatedCell
                          value={query.query}
                          maxWidth={400}
                          className="bg-muted px-2 py-1 rounded"
                        />
                        <span className="text-xs text-muted-foreground mt-1 block">
                          ID: {query.query_id.slice(0, 8)}...
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {query.user}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {query.elapsed.toFixed(2)}s
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatBytes(query.read_bytes)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatBytes(query.memory_usage)}
                      </TableCell>
                      <TableCell>
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
                                This will terminate the query immediately. This
                                action cannot be undone.
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </Card>
    </div>
  );
}
