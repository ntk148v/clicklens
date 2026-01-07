"use client";

import { useState, useMemo } from "react";
import { Loader2, Filter, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
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
import { PaginationControls } from "@/components/monitoring/pagination-controls";
import {
  useQueryHistory,
  type QueryHistoryEntry,
} from "@/lib/hooks/use-query-analytics";
import { formatDuration, formatBytes } from "@/lib/hooks/use-monitoring";
import { TruncatedCell } from "@/components/ui/truncated-cell";

const DEFAULT_PAGE_SIZE = 50;

export function HistoryTab() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [userFilter, setUserFilter] = useState("");
  const [minDuration, setMinDuration] = useState("");
  const [queryType, setQueryType] = useState("");

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    null
  );

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
  const sortedHistory = data?.queries
    ? [...data.queries].sort((a, b) => {
        if (!sortColumn || !sortDirection) return 0;

        // ... logic same ...
        const aValue = a[sortColumn as keyof QueryHistoryEntry];
        const bValue = b[sortColumn as keyof QueryHistoryEntry];

        // ... check types ...
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

  const totalPages = useMemo(() => {
    if (!data?.total) return 0;
    return Math.ceil(data.total / pageSize);
  }, [data?.total, pageSize]);

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
            {data?.total ? data.total.toLocaleString() : 0} total queries
          </Badge>
        </div>
      </Card>

      {/* History Table */}
      <Card className="flex-1 overflow-hidden border-none shadow-none flex flex-col">
        <div className="flex-1 border rounded-md overflow-auto relative">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  className="min-w-[150px]"
                  currentSort={sortColumn === "query_id" ? sortDirection : null}
                  onSort={(dir) => updateSort("query_id", dir)}
                >
                  Query ID
                </SortableTableHead>
                <SortableTableHead
                  className="min-w-[300px]"
                  currentSort={sortColumn === "query" ? sortDirection : null}
                  onSort={(dir) => updateSort("query", dir)}
                >
                  Query
                </SortableTableHead>
                <SortableTableHead
                  currentSort={sortColumn === "user" ? sortDirection : null}
                  onSort={(dir) => updateSort("user", dir)}
                >
                  User
                </SortableTableHead>
                <SortableTableHead
                  className="text-right ml-auto"
                  currentSort={
                    sortColumn === "event_time" ? sortDirection : null
                  }
                  onSort={(dir) => updateSort("event_time", dir)}
                >
                  Time
                </SortableTableHead>
                <SortableTableHead
                  className="text-right ml-auto"
                  currentSort={
                    sortColumn === "query_duration_ms" ? sortDirection : null
                  }
                  onSort={(dir) => updateSort("query_duration_ms", dir)}
                >
                  Duration
                </SortableTableHead>
                <SortableTableHead
                  className="text-right ml-auto"
                  currentSort={
                    sortColumn === "read_rows" ? sortDirection : null
                  }
                  onSort={(dir) => updateSort("read_rows", dir)}
                >
                  Read Rows
                </SortableTableHead>
                <SortableTableHead
                  className="text-right ml-auto"
                  currentSort={
                    sortColumn === "read_bytes" ? sortDirection : null
                  }
                  onSort={(dir) => updateSort("read_bytes", dir)}
                >
                  Read Bytes
                </SortableTableHead>
                <SortableTableHead
                  className="text-right ml-auto"
                  currentSort={
                    sortColumn === "memory_usage" ? sortDirection : null
                  }
                  onSort={(dir) => updateSort("memory_usage", dir)}
                >
                  Memory
                </SortableTableHead>
                <SortableTableHead
                  currentSort={
                    sortColumn === "exception" ? sortDirection : null
                  }
                  onSort={(dir) => updateSort("exception", dir)}
                >
                  Status
                </SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHistory.length > 0 ? (
                sortedHistory.map((query) => (
                  <TableRow key={query.query_id}>
                    <TableCell className="font-mono text-xs">
                      <TruncatedCell value={query.query_id} maxWidth={150} />
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[500px]">
                        <TruncatedCell
                          value={query.query}
                          maxWidth={500}
                          className="bg-muted px-2 py-1 rounded"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{query.user}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap text-right">
                      {new Date(query.event_time).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatDuration(query.query_duration_ms)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {query.read_rows.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatBytes(query.read_bytes)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatBytes(query.memory_usage)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {query.exception ? (
                        <Badge variant="destructive">Error</Badge>
                      ) : (
                        <Badge variant="secondary">Success</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    No queries found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
