"use client";

import { useState } from "react";
import {
  Loader2,
  TrendingUp,
  Clock,
  HardDrive,
  Zap,
  AlertTriangle,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  useQueryAnalytics,
  type ExpensiveQuery,
} from "@/lib/hooks/use-query-analytics";
import {
  formatDuration,
  formatBytes,
  formatNumber,
} from "@/lib/hooks/use-monitoring";
import { TruncatedCell } from "@/components/ui/truncated-cell";
import { PaginationControls } from "@/components/monitoring";

const DEFAULT_PAGE_SIZE = 50;

import { useRouter } from "next/navigation";

export function AnalyticsTab() {
  const router = useRouter();
  const [metric, setMetric] = useState<"duration" | "memory" | "read_bytes">(
    "duration"
  );

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | undefined>("count");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    "desc"
  );

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data, isLoading, error } = useQueryAnalytics(metric);

  const sortedQueries = data?.queries
    ? [...data.queries].sort((a, b) => {
        if (!sortColumn || !sortDirection) return 0;

        const aValue = a[sortColumn as keyof ExpensiveQuery];
        const bValue = b[sortColumn as keyof ExpensiveQuery];

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const comparison = aValue < bValue ? -1 : 1;
        return sortDirection === "asc" ? comparison : -comparison;
      })
    : [];

  const paginatedQueries = sortedQueries.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const totalPages = Math.ceil(sortedQueries.length / pageSize);

  const updateSort = (column: string, direction: "asc" | "desc" | null) => {
    setSortColumn(column);
    setSortDirection(direction);
  };

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

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Clock className="h-12 w-12 mb-4 opacity-50" />
        <p>No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 h-full flex flex-col">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              Total Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data.summary.total_queries)}
            </div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Total Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(data.summary.total_duration_ms)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-green-500" />
              Data Read
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(data.summary.total_read_bytes)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Peak Memory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(data.summary.total_memory)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatNumber(data.summary.failed_queries)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metric Tabs */}
      <Tabs
        value={metric}
        onValueChange={(v) => setMetric(v as typeof metric)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList>
          <TabsTrigger value="duration">
            <Clock className="h-3 w-3 mr-1" />
            Slowest
          </TabsTrigger>
          <TabsTrigger value="memory">
            <HardDrive className="h-3 w-3 mr-1" />
            Most Memory
          </TabsTrigger>
          <TabsTrigger value="read_bytes">
            <TrendingUp className="h-3 w-3 mr-1" />
            Most Data Read
          </TabsTrigger>
        </TabsList>

        <Card className="mt-4 flex-1 overflow-hidden border-none shadow-none flex flex-col">
          <CardHeader className="px-0">
            <CardTitle className="text-sm">
              Top Query Patterns (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <div className="flex-1 border rounded-md overflow-hidden relative">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    className="min-w-[400px]"
                    currentSort={sortColumn === "query" ? sortDirection : null}
                    onSort={(dir) => updateSort("query", dir)}
                  >
                    Query Pattern
                  </SortableTableHead>
                  <SortableTableHead
                    className="min-w-[100px]"
                    currentSort={sortColumn === "user" ? sortDirection : null}
                    onSort={(dir) => updateSort("user", dir)}
                  >
                    User
                  </SortableTableHead>
                  <SortableTableHead
                    className="text-right ml-auto"
                    currentSort={sortColumn === "count" ? sortDirection : null}
                    onSort={(dir) => updateSort("count", dir)}
                  >
                    Count
                  </SortableTableHead>
                  <SortableTableHead
                    className="text-right ml-auto"
                    currentSort={
                      sortColumn === "avg_duration_ms" ? sortDirection : null
                    }
                    onSort={(dir) => updateSort("avg_duration_ms", dir)}
                  >
                    Avg Duration
                  </SortableTableHead>
                  <SortableTableHead
                    className="text-right ml-auto"
                    currentSort={
                      sortColumn === "avg_read_bytes" ? sortDirection : null
                    }
                    onSort={(dir) => updateSort("avg_read_bytes", dir)}
                  >
                    Avg Read Bytes
                  </SortableTableHead>
                  <SortableTableHead
                    className="text-right ml-auto"
                    currentSort={
                      sortColumn === "avg_memory" ? sortDirection : null
                    }
                    onSort={(dir) => updateSort("avg_memory", dir)}
                  >
                    Avg Memory
                  </SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody isLoading={isLoading}>
                {paginatedQueries.map((query, idx) => (
                  <TableRow key={query.normalized_query_hash || idx}>
                    <TableCell>
                      <button
                        className="text-left w-full hover:bg-muted/50 rounded p-1 transition-colors group"
                        onClick={() =>
                          router.push(
                            `/queries/history?fingerprint=${query.normalized_query_hash}`
                          )
                        }
                      >
                        <TruncatedCell
                          value={query.query}
                          maxWidth={400}
                          className="bg-muted px-2 py-1 rounded group-hover:bg-background transition-colors"
                        />
                        <span className="text-xs text-blue-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          View details <TrendingUp className="w-3 h-3" />
                        </span>
                      </button>
                      <span className="text-xs text-muted-foreground mt-1 block px-1">
                        Last run:{" "}
                        {new Date(query.last_event_time).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {query.user}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatNumber(query.count)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatDuration(query.avg_duration_ms)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatBytes(query.avg_read_bytes)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatBytes(query.avg_memory)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={sortedQueries.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Tabs>
    </div>
  );
}
