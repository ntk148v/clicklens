"use client";

import { useState, useMemo } from "react";
import { Loader2, Zap, CheckCircle, XCircle, Clock } from "lucide-react";
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
import { PaginationControls } from "@/components/monitoring";
import { useTableMutations } from "@/lib/hooks/use-table-explorer";

interface MutationsTabProps {
  database: string;
  table: string;
}

const DEFAULT_PAGE_SIZE = 50;

export function MutationsTab({ database, table }: MutationsTabProps) {
  const { data, isLoading, error } = useTableMutations(database, table);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const paginatedMutations = useMemo(() => {
    if (!data?.mutations) return [];
    const start = (page - 1) * pageSize;
    return data.mutations.slice(start, start + pageSize);
  }, [data?.mutations, page, pageSize]);

  const totalPages = useMemo(() => {
    if (!data?.mutations) return 0;
    return Math.ceil(data.mutations.length / pageSize);
  }, [data?.mutations, pageSize]);

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

  if (!data || data.mutations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Zap className="h-12 w-12 mb-4 opacity-50" />
        <p>No mutations found for this table</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {data.summary.pending}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.summary.completed}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data.summary.failed}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mutations Table */}
      <Card>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mutation ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Parts To Do</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="min-w-[300px]">Command</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMutations.map((mutation) => {
                const isFailed = !!mutation.latest_fail_reason;
                const isDone = mutation.is_done === 1;
                return (
                  <TableRow key={mutation.mutation_id}>
                    <TableCell className="font-mono text-xs">
                      {mutation.mutation_id}
                    </TableCell>
                    <TableCell>
                      {isFailed ? (
                        <Badge variant="destructive" className="text-xs">
                          Failed
                        </Badge>
                      ) : isDone ? (
                        <Badge
                          variant="outline"
                          className="text-xs text-green-600 border-green-600"
                        >
                          Done
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Pending ({mutation.parts_to_do} parts)
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {mutation.parts_to_do}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(mutation.create_time).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono block truncate max-w-[400px]">
                        {mutation.command}
                      </code>
                      {isFailed && (
                        <div className="text-xs text-red-500 mt-1">
                          Error: {mutation.latest_fail_reason}
                        </div>
                      )}
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
          totalItems={data.mutations.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>
    </div>
  );
}
