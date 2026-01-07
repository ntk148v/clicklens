"use client";

import { useState, useMemo } from "react";
import { Loader2, Layers } from "lucide-react";
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
import { PaginationControls, StatusBadge } from "@/components/monitoring";
import { useTableParts } from "@/lib/hooks/use-table-explorer";
import { formatBytes, formatNumber } from "@/lib/hooks/use-monitoring";

interface PartsTabProps {
  database: string;
  table: string;
}

const DEFAULT_PAGE_SIZE = 50;

export function PartsTab({ database, table }: PartsTabProps) {
  const { data, isLoading, error } = useTableParts(database, table);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const paginatedParts = useMemo(() => {
    if (!data?.parts) return [];
    const start = (page - 1) * pageSize;
    return data.parts.slice(start, start + pageSize);
  }, [data?.parts, page, pageSize]);

  const totalPages = useMemo(() => {
    if (!data?.parts) return 0;
    return Math.ceil(data.parts.length / pageSize);
  }, [data?.parts, pageSize]);

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

  if (!data || data.parts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Layers className="h-12 w-12 mb-4 opacity-50" />
        <p>No parts found for this table</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Parts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total_parts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Rows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(data.summary.total_rows)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Size on Disk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(data.summary.total_bytes)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Compressed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(data.summary.total_compressed)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Compression Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data.summary.avg_compression_ratio * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Parts Table */}
      <Card>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Partition</TableHead>
                <TableHead>Part Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead className="text-right">Compression</TableHead>
                <TableHead>Modified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedParts.map((part) => (
                <TableRow key={part.name}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {part.partition}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {part.name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        part.part_type === "Wide" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {part.part_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatNumber(part.rows)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatBytes(part.bytes_on_disk)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {part.compression_ratio
                      ? `${(part.compression_ratio * 100).toFixed(1)}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(part.modification_time).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={data.parts.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>
    </div>
  );
}
