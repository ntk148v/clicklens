"use client";

import { useState, useMemo } from "react";
import { Loader2, Columns } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { PaginationControls } from "@/components/monitoring";
import { useTableColumns } from "@/lib/hooks/use-table-explorer";
import { formatBytes, formatNumber } from "@/lib/hooks/use-monitoring";

interface ColumnsTabProps {
  database: string;
  table: string;
}

const DEFAULT_PAGE_SIZE = 50;

export function ColumnsTab({ database, table }: ColumnsTabProps) {
  const { data, isLoading, error } = useTableColumns(database, table);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const paginatedColumns = useMemo(() => {
    if (!data?.columns) return [];
    const start = (page - 1) * pageSize;
    return data.columns.slice(start, start + pageSize);
  }, [data?.columns, page, pageSize]);

  const totalPages = useMemo(() => {
    if (!data?.columns) return 0;
    return Math.ceil(data.columns.length / pageSize);
  }, [data?.columns, pageSize]);

  // Calculate max size for progress bar
  const maxBytes = useMemo(() => {
    if (!data?.columns) return 0;
    return Math.max(...data.columns.map((c) => Number(c.bytes_on_disk)));
  }, [data?.columns]);

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

  if (!data || data.columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Columns className="h-12 w-12 mb-4 opacity-50" />
        <p>No column stats available for this table</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Columns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.total_columns}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(data.summary.total_bytes)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Uncompressed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(data.summary.total_uncompressed)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Compression
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data.summary.avg_compression_ratio * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Columns Table */}
      <Card>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Column</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="min-w-[150px]">Size %</TableHead>
                <TableHead className="text-right">Compression</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedColumns.map((col) => {
                const sizePercent =
                  maxBytes > 0
                    ? (Number(col.bytes_on_disk) / maxBytes) * 100
                    : 0;
                return (
                  <TableRow key={col.column}>
                    <TableCell className="font-mono font-medium">
                      {col.column}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {col.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatBytes(col.bytes_on_disk)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={sizePercent} className="h-2" />
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {sizePercent.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {(col.compression_ratio * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={data.columns.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>
    </div>
  );
}
