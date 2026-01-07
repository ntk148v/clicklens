"use client";

import { useState, useMemo } from "react";
import { Loader2, Filter, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PaginationControls } from "@/components/monitoring";
import { useQueryHistory } from "@/lib/hooks/use-query-analytics";
import { formatBytes, formatNumber } from "@/lib/hooks/use-monitoring";
import { TruncatedCell } from "@/components/ui/truncated-cell";
import { SortableHeader, SortDirection } from "@/components/ui/sortable-header";
import type { QueryHistoryEntry } from "@/lib/hooks/use-query-analytics";

const DEFAULT_PAGE_SIZE = 50;

export function HistoryTab() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [userFilter, setUserFilter] = useState("");
  const [minDuration, setMinDuration] = useState("");
  const [queryType, setQueryType] = useState("");

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const filters = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      user: userFilter || undefined,
      minDuration: minDuration ? parseInt(minDuration) : undefined,
      queryType: queryType || undefined,
    }),
    [page, pageSize, userFilter, minDuration, queryType]
  );

  const { data, isLoading, error } = useQueryHistory(filters);

  // Client-side sorting of the fetched page
  // Note: For true global sorting, API needs update.
  // This sorts the current page which is a standard limitation without backend support.
  const sortedQueries = useMemo(() => {
    if (!data?.queries) return [];
    if (!sortColumn || !sortDirection) return data.queries;

    return [...data.queries].sort((a, b) => {
      const aValue = a[sortColumn as keyof QueryHistoryEntry];
      const bValue = b[sortColumn as keyof QueryHistoryEntry];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [data?.queries, sortColumn, sortDirection]);

  const totalPages = useMemo(() => {
    if (!data?.total) return 0;
    return Math.ceil(data.total / pageSize);
  }, [data?.total, pageSize]);

  const handleSort = (column: string, direction: SortDirection) => {
    setSortColumn(column);
    setSortDirection(direction);
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

  return (
    <div className="space-y-4 p-4 h-full flex flex-col">
      {/* Filters */}
      <Card className="p-4 flex-none">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          <Input
            placeholder="User..."
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-[150px]"
          />
          <Input
            placeholder="Min duration (ms)"
            value={minDuration}
            onChange={(e) => setMinDuration(e.target.value)}
            className="w-[150px]"
            type="number"
          />
          <Select
            value={queryType || "all"}
            onValueChange={(v) => setQueryType(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Query type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Select">SELECT</SelectItem>
              <SelectItem value="Insert">INSERT</SelectItem>
              <SelectItem value="Create">CREATE</SelectItem>
              <SelectItem value="Alter">ALTER</SelectItem>
              <SelectItem value="Drop">DROP</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="ml-auto">
            {data?.total ? formatNumber(data.total) : 0} total queries
          </Badge>
        </div>
      </Card>

      {/* History Table */}
      <Card className="flex-1 overflow-hidden border-none shadow-none flex flex-col">
        <div className="flex-1 border rounded-md overflow-hidden relative">
          <ScrollArea className="h-full">
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
                    <TableHead>
                      <SortableHeader
                        column="query_kind"
                        sortedColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Type
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        column="query_duration_ms"
                        sortedColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        className="ml-auto"
                      >
                        Duration
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
                    <TableHead>
                      <SortableHeader
                        column="event_time"
                        sortedColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Time
                      </SortableHeader>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedQueries.length > 0 ? (
                    sortedQueries.map((query, idx) => (
                      <TableRow key={`${query.query_id}-${idx}`}>
                        <TableCell>
                          <div className="max-w-[500px]">
                            <TruncatedCell
                              value={query.query}
                              maxWidth={500}
                              className="bg-muted px-2 py-1 rounded"
                            />
                            {query.exception && (
                              <span className="text-xs text-destructive mt-1 block truncate">
                                Error: {query.exception.slice(0, 100)}...
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {query.user}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {query.query_kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {query.query_duration_ms.toLocaleString()} ms
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatBytes(query.read_bytes)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatBytes(query.memory_usage)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(query.event_time).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        No queries found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={data?.total || 0}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>
    </div>
  );
}
