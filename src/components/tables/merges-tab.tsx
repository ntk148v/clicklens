"use client";

import { Loader2, Combine, Activity } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTableMerges } from "@/lib/hooks/use-table-explorer";
import { formatBytes, formatNumber } from "@/lib/hooks/use-monitoring";

interface MergesTabProps {
  database: string;
  table: string;
}

export function MergesTab({ database, table }: MergesTabProps) {
  const { data, isLoading, error } = useTableMerges(database, table);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | undefined>("elapsed");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    "desc"
  );

  const merges = data?.merges;

  const sortedMerges = useMemo(() => {
    if (!merges) return [];

    return [...merges].sort((a, b) => {
      if (!sortColumn || !sortDirection) return 0;

      const aValue = a[sortColumn as keyof typeof a];
      const bValue = b[sortColumn as keyof typeof b];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [merges, sortColumn, sortDirection]);

  const updateSort = (column: string, direction: "asc" | "desc" | null) => {
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

  if (!data || data.merges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Combine className="h-12 w-12 mb-4 opacity-50" />
        <p>No active merges for this table</p>
        <p className="text-sm mt-2">Merges will appear here when in progress</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 h-full flex flex-col">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Active Merges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.active_merges}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(data.summary.total_memory_usage)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Bytes to Merge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBytes(data.summary.total_bytes_to_merge)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Merges Table */}
      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                currentSort={
                  sortColumn === "result_part_name" ? sortDirection : null
                }
                onSort={(dir) => updateSort("result_part_name", dir)}
              >
                Result Part
              </SortableTableHead>
              <SortableTableHead
                currentSort={sortColumn === "merge_type" ? sortDirection : null}
                onSort={(dir) => updateSort("merge_type", dir)}
              >
                Type
              </SortableTableHead>
              <SortableTableHead
                className="min-w-[150px]"
                currentSort={sortColumn === "progress" ? sortDirection : null}
                onSort={(dir) => updateSort("progress", dir)}
              >
                Progress
              </SortableTableHead>
              <SortableTableHead
                className="text-right"
                currentSort={sortColumn === "num_parts" ? sortDirection : null}
                onSort={(dir) => updateSort("num_parts", dir)}
              >
                Parts
              </SortableTableHead>
              <SortableTableHead
                className="text-right"
                currentSort={
                  sortColumn === "rows_written" ? sortDirection : null
                }
                onSort={(dir) => updateSort("rows_written", dir)}
              >
                Rows
              </SortableTableHead>
              <SortableTableHead
                className="text-right"
                currentSort={
                  sortColumn === "memory_usage" ? sortDirection : null
                }
                onSort={(dir) => updateSort("memory_usage", dir)}
              >
                Memory
              </SortableTableHead>
              <SortableTableHead
                className="text-right"
                currentSort={sortColumn === "elapsed" ? sortDirection : null}
                onSort={(dir) => updateSort("elapsed", dir)}
              >
                Elapsed
              </SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody isLoading={isLoading}>
            {sortedMerges.map((merge, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-mono text-xs">
                  {merge.result_part_name}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={merge.is_mutation === 1 ? "secondary" : "default"}
                    className="text-xs"
                  >
                    {merge.is_mutation === 1 ? "Mutation" : merge.merge_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={merge.progress * 100} className="h-2" />
                    <span className="text-xs font-mono w-12 text-right">
                      {(merge.progress * 100).toFixed(1)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {merge.num_parts}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatNumber(merge.rows_written)} /{" "}
                  {formatNumber(merge.rows_read)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatBytes(merge.memory_usage)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {merge.elapsed.toFixed(1)}s
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>
    </div>
  );
}
