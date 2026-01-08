"use client";

import { useState, useMemo } from "react";
import {
  Loader2,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
  TableHeader,
  TableRow,
  ClickableTableRow,
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
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { TruncatedCell } from "@/components/ui/truncated-cell";

const DEFAULT_PAGE_SIZE = 50;

export function HistoryTab() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialFingerprint = searchParams.get("fingerprint") || "";

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Filter state (for API)
  const [userFilter, setUserFilter] = useState("");
  const [minDuration, setMinDuration] = useState("");
  const [queryType, setQueryType] = useState("");
  const [status, setStatus] = useState<"all" | "success" | "error">("all");
  const [fingerprint, setFingerprint] = useState(initialFingerprint);

  // Input state (local)
  const [userInput, setUserInput] = useState("");
  const [durationInput, setDurationInput] = useState("");

  const handleSearch = () => {
    setUserFilter(userInput);
    setMinDuration(durationInput);
    setPage(1); // Reset to first page on new search
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

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
      status: status,
      fingerprint: fingerprint || undefined,
    }),
    [page, pageSize, userFilter, minDuration, queryType, status, fingerprint]
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
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-1">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters:</span>
        </div>
        <Input
          placeholder="User..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSearch}
          className="w-[150px]"
        />
        <Input
          placeholder="Min duration (ms)"
          value={durationInput}
          onChange={(e) => setDurationInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSearch}
          className="w-[150px]"
          type="number"
        />
        <Select
          value={queryType || "all"}
          onValueChange={(v) => {
            setQueryType(v === "all" ? "" : v);
            setPage(1);
          }}
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
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as "all" | "success" | "error");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="ml-auto border-none bg-muted/50">
          {data?.total ? data.total.toLocaleString() : 0} total queries
        </Badge>
      </div>

      {fingerprint && (
        <div className="px-1">
          <Badge variant="secondary" className="gap-2 pl-2 pr-1 py-1 h-7">
            Filtered by Query Pattern: {fingerprint.substring(0, 8)}...
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 rounded-full ml-1 hover:bg-muted/50"
              onClick={() => {
                setFingerprint("");
                const params = new URLSearchParams(searchParams.toString());
                params.delete("fingerprint");
                router.replace(`${pathname}?${params.toString()}`);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        </div>
      )}

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
                sortedHistory.map((query, index) => (
                  <ClickableTableRow
                    key={query.query_id}
                    record={query}
                    columns={[
                      { name: "query_id", type: "String" },
                      { name: "query", type: "String" },
                      { name: "user", type: "String" },
                      { name: "event_time", type: "DateTime" },
                      { name: "query_duration_ms", type: "UInt64" },
                      { name: "read_rows", type: "UInt64" },
                      { name: "read_bytes", type: "UInt64" },
                      { name: "memory_usage", type: "UInt64" },
                      { name: "exception", type: "String" },
                    ]}
                    rowIndex={index}
                    sheetTitle="Query Details"
                  >
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
                        <Badge
                          variant="destructive"
                          className="flex items-center gap-1 w-fit"
                        >
                          <AlertCircle className="w-3 h-3" />
                          Error
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400 w-fit"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Success
                        </Badge>
                      )}
                    </TableCell>
                  </ClickableTableRow>
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
