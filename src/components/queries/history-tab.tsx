"use client";

import { useState, useMemo } from "react";
import { Loader2, Clock, Search, Filter } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/monitoring";
import { useQueryHistory } from "@/lib/hooks/use-query-analytics";
import { formatBytes, formatNumber } from "@/lib/hooks/use-monitoring";
import { TruncatedCell } from "@/components/ui/truncated-cell";

const DEFAULT_PAGE_SIZE = 50;

export function HistoryTab() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [userFilter, setUserFilter] = useState("");
  const [minDuration, setMinDuration] = useState("");
  const [queryType, setQueryType] = useState("");

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

  if (!data || data.queries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Clock className="h-12 w-12 mb-4 opacity-50" />
        <p>No query history found</p>
        <p className="text-sm mt-2">
          Query history will appear here after queries are executed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Filters */}
      <Card className="p-4">
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
            {formatNumber(data.total)} total queries
          </Badge>
        </div>
      </Card>

      {/* History Table */}
      <Card>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[300px]">Query</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Read</TableHead>
                <TableHead className="text-right">Memory</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.queries.map((query, idx) => (
                <TableRow key={`${query.query_id}-${idx}`}>
                  <TableCell>
                    <TruncatedCell
                      value={query.query}
                      maxWidth={400}
                      className="bg-muted px-2 py-1 rounded"
                    />
                    {query.exception && (
                      <span className="text-xs text-destructive mt-1 block truncate">
                        Error: {query.exception.slice(0, 100)}...
                      </span>
                    )}
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
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(query.event_time).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={data.total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>
    </div>
  );
}
