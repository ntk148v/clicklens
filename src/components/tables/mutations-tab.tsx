"use client";

import { useState, useMemo } from "react";
import { Loader2, Zap, CheckCircle, XCircle, Clock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationControls } from "@/components/monitoring";
import { useTableMutations } from "@/lib/hooks/use-table-explorer";
import { TruncatedCell } from "@/components/ui/truncated-cell";

interface MutationsTabProps {
  database: string;
  table: string;
}

const DEFAULT_PAGE_SIZE = 50;

export function MutationsTab({ database, table }: MutationsTabProps) {
  const { data, isLoading, error } = useTableMutations(database, table);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | undefined>(
    "create_time"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>(
    "desc"
  );

  const mutations = data?.mutations;

  const sortedMutations = useMemo(() => {
    if (!mutations) return [];

    return [...mutations].sort((a, b) => {
      if (!sortColumn || !sortDirection) return 0;

      // Type safety hack: assume keys exist
      const aValue = a[sortColumn as keyof typeof a];
      const bValue = b[sortColumn as keyof typeof b];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [mutations, sortColumn, sortDirection]);

  const paginatedMutations = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedMutations.slice(start, start + pageSize);
  }, [sortedMutations, page, pageSize]);

  const updateSort = (column: string, direction: "asc" | "desc" | null) => {
    setSortColumn(column);
    setSortDirection(direction);
  };

  const totalPages = useMemo(() => {
    if (!mutations) return 0;
    return Math.ceil(mutations.length / pageSize);
  }, [mutations, pageSize]);

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
    <div className="space-y-4 p-4 h-full flex flex-col">
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
      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                currentSort={
                  sortColumn === "mutation_id" ? sortDirection : null
                }
                onSort={(dir) => updateSort("mutation_id", dir)}
              >
                Mutation ID
              </SortableTableHead>
              <SortableTableHead
                currentSort={sortColumn === "is_done" ? sortDirection : null}
                onSort={(dir) => updateSort("is_done", dir)}
              >
                Status
              </SortableTableHead>
              <SortableTableHead
                currentSort={
                  sortColumn === "parts_to_do" ? sortDirection : null
                }
                onSort={(dir) => updateSort("parts_to_do", dir)}
              >
                Parts To Do
              </SortableTableHead>
              <SortableTableHead
                currentSort={
                  sortColumn === "create_time" ? sortDirection : null
                }
                onSort={(dir) => updateSort("create_time", dir)}
              >
                Created
              </SortableTableHead>
              <SortableTableHead
                className="min-w-[300px]"
                currentSort={sortColumn === "command" ? sortDirection : null}
                onSort={(dir) => updateSort("command", dir)}
              >
                Command
              </SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody isLoading={isLoading}>
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
                    {mutation.create_time}
                  </TableCell>
                  <TableCell className="text-xs">
                    <TruncatedCell
                      value={mutation.command}
                      maxWidth={400}
                      className="bg-muted px-2 py-1 rounded"
                    />
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
        <div className="p-2 border-t">
          <PaginationControls
            page={page}
            totalPages={totalPages}
            totalItems={data.mutations.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </TableWrapper>
    </div>
  );
}
