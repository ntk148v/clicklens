"use client";

import { useState } from "react";
import { Loader2, Database, AlertCircle } from "lucide-react";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useQueryCache } from "@/lib/hooks/use-query-analytics";
import { formatBytes } from "@/lib/hooks/use-monitoring";
import { TruncatedCell } from "@/components/ui/truncated-cell";
import { SortableHeader, SortDirection } from "@/components/ui/sortable-header";
import type { QueryCacheEntry } from "@/lib/hooks/use-query-analytics";

export function CacheTab() {
  const { data, isLoading, error } = useQueryCache();

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const sortedEntries = data?.entries
    ? [...data.entries].sort((a, b) => {
        if (!sortColumn || !sortDirection) return 0;

        const aValue = a[sortColumn as keyof QueryCacheEntry];
        const bValue = b[sortColumn as keyof QueryCacheEntry];

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

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Database className="h-12 w-12 mb-4 opacity-50" />
        <p>No cache data available</p>
      </div>
    );
  }

  if (!data.available) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
        <p>Query Cache Not Available</p>
        <p className="text-sm mt-2 max-w-md text-center">
          Query cache is available in ClickHouse 23.4+. Make sure it's enabled
          in your server configuration.
        </p>
        <code className="text-xs bg-muted px-3 py-2 rounded font-mono mt-4">
          SET use_query_cache = 1
        </code>
      </div>
    );
  }

  if (data.entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Database className="h-12 w-12 mb-4 opacity-50" />
        <p>Query cache is empty</p>
        <p className="text-sm mt-2">
          Run queries with{" "}
          <code className="text-primary">SETTINGS use_query_cache = 1</code> to
          populate
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Cached Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.total_entries}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(data.summary.total_size)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Stale Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {data.summary.stale_count}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cache Entries Table */}
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
                    <TableHead className="text-right">
                      <SortableHeader
                        column="result_size"
                        sortedColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        className="ml-auto"
                      >
                        Size
                      </SortableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        column="stale"
                        sortedColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Status
                      </SortableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableHeader
                        column="expires_at"
                        sortedColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Expires
                      </SortableHeader>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEntries.map((entry, idx) => (
                    <TableRow key={entry.key_hash || idx}>
                      <TableCell>
                        <TruncatedCell
                          value={entry.query}
                          maxWidth={400}
                          className="bg-muted px-2 py-1 rounded"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatBytes(entry.result_size)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {entry.stale === 1 && (
                            <Badge variant="secondary" className="text-xs">
                              Stale
                            </Badge>
                          )}
                          {entry.compressed === 1 && (
                            <Badge variant="outline" className="text-xs">
                              Compressed
                            </Badge>
                          )}
                          {entry.shared === 1 && (
                            <Badge variant="outline" className="text-xs">
                              Shared
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(entry.expires_at).toLocaleString()}
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
