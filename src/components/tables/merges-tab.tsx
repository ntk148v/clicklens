"use client";

import { Loader2, Combine, Activity } from "lucide-react";
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
import { useTableMerges } from "@/lib/hooks/use-table-explorer";
import { formatBytes, formatNumber } from "@/lib/hooks/use-monitoring";

interface MergesTabProps {
  database: string;
  table: string;
}

export function MergesTab({ database, table }: MergesTabProps) {
  const { data, isLoading, error, refetch } = useTableMerges(database, table);

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
    <div className="space-y-4 p-4">
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
      <Card>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Result Part</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="min-w-[150px]">Progress</TableHead>
                <TableHead className="text-right">Parts</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Memory</TableHead>
                <TableHead className="text-right">Elapsed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.merges.map((merge, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-xs">
                    {merge.result_part_name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        merge.is_mutation === 1 ? "secondary" : "default"
                      }
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
        </div>
      </Card>
    </div>
  );
}
