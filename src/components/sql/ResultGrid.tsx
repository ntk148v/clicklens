"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnResizeMode,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
  TableHeader,
  TableRow,
  ClickableTableRow,
  TableWrapper,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Download } from "lucide-react";
import { cn, copyToClipboard, formatDateTime } from "@/lib/utils";
import { PaginationControls, TruncatedCell } from "@/components/monitoring";

interface ColumnMeta {
  name: string;
  type: string;
}

interface QueryStatistics {
  elapsed: number;
  rows_read: number;
  bytes_read: number;
}

interface ResultGridProps {
  data: unknown[];
  meta: ColumnMeta[];
  statistics?: QueryStatistics;
  totalRows?: number;
  className?: string;
  page?: number; // 0-indexed
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  isLoading?: boolean;
}

// ... imports and helper functions ...

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

function formatDuration(seconds: number): string {
  if (seconds < 0.001) return `${(seconds * 1000000).toFixed(0)}µs`;
  if (seconds < 1) return `${(seconds * 1000).toFixed(2)}ms`;
  return `${seconds.toFixed(3)}s`;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);

  if (typeof value === "string") {
    // Try to detect if it's an ISO date string
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return formatDateTime(value);
    }
  }

  return String(value);
}

function getCellClassName(value: unknown): string {
  if (value === null || value === undefined)
    return "text-muted-foreground italic";
  if (typeof value === "number") return "text-right font-mono text-blue-600";
  if (typeof value === "boolean") return "text-purple-600";
  return "";
}

export function ResultGrid({
  data,
  meta,
  statistics,
  totalRows,
  className,
  page = 0,
  pageSize = 100,
  onPageChange,
  onPageSizeChange,
  isLoading,
}: ResultGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

  const columns = useMemo<ColumnDef<unknown>[]>(() => {
    return meta.map((col, idx) => ({
      id: `${String(col.name)}_${idx}`,
      accessorFn: (row: unknown) => {
        // Handle both array (streamed) and object (legacy/static) formats if necessary
        // But for this tab, it's likely array now.
        // Safety check if row is array
        if (Array.isArray(row)) return row[idx];
        // Fallback for object-based rows (if any legacy path remains)
        return (row as Record<string, unknown>)[col.name];
      },
      header: () => (
        <div className="flex items-center gap-1">
          <span className="font-semibold">{col.name}</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1 py-0 font-mono text-muted-foreground"
          >
            {col.type}
          </Badge>
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue();
        return (
          <TruncatedCell
            value={formatCellValue(value)}
            className={getCellClassName(value)}
          />
        );
      },
      size: 150,
      minSize: 80,
      enableResizing: true,
    }));
  }, [meta]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      // If controlled pagination
      pagination: {
        pageIndex: page,
        pageSize: pageSize,
      },
    },
    manualPagination: !!onPageChange, // Enable manual pagination if onPageChange is provided
    pageCount: totalRows ? Math.ceil(totalRows / pageSize) : -1, // -1 means unknown page count
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode,
  });

  const handleCopyToClipboard = async () => {
    const headers = meta.map((c) => c.name).join("\t");
    const rows = data.map((row) =>
      meta
        .map((c, idx) => {
          let value: unknown;
          if (Array.isArray(row)) {
            value = row[idx];
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value = (row as any)[c.name];
          }
          return formatCellValue(value);
        })
        .join("\t")
    );
    const text = [headers, ...rows].join("\n");
    await copyToClipboard(text);
  };

  const downloadCsv = () => {
    const headers = meta.map((c) => `"${c.name}"`).join(",");
    const rows = data.map((row) =>
      meta
        .map((c, idx) => {
          let value: unknown;
          if (Array.isArray(row)) {
            value = row[idx];
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value = (row as any)[c.name];
          }
          return formatCellValue(value);
        })
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query-result-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No results
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Statistics bar */}
      {statistics && (
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 text-xs">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>
              <strong className="text-foreground">
                {formatNumber(totalRows ?? data.length)}
              </strong>{" "}
              rows
            </span>
            <span>
              <strong className="text-foreground">
                {formatNumber(statistics.rows_read)}
              </strong>{" "}
              rows read
            </span>
            <span>
              <strong className="text-foreground">
                {formatBytes(statistics.bytes_read)}
              </strong>{" "}
              read
            </span>
            <span>
              <strong className="text-foreground">
                {formatDuration(statistics.elapsed)}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleCopyToClipboard}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={downloadCsv}
            >
              <Download className="w-3 h-3 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      )}

      <TableWrapper>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <SortableTableHead
                    key={header.id}
                    className="whitespace-nowrap"
                    style={{ width: header.getSize() }}
                    sortable={header.column.getCanSort()}
                    currentSort={
                      header.column.getIsSorted() as "asc" | "desc" | null
                    }
                    onSort={(dir) => {
                      if (!dir) header.column.clearSorting();
                      else header.column.toggleSorting(dir === "desc");
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </SortableTableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody isLoading={isLoading}>
            {table.getRowModel().rows.map((row, rowIndex) => (
              <ClickableTableRow
                key={row.id}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                record={data[page * pageSize + rowIndex] as any}
                columns={meta}
                rowIndex={page * pageSize + rowIndex}
                sheetTitle="Query Result"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="py-1.5 px-4 font-mono text-sm"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </ClickableTableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>

      {/* Pagination */}
      <PaginationControls
        page={table.getState().pagination.pageIndex + 1}
        totalPages={table.getPageCount()}
        totalItems={totalRows ?? data.length}
        pageSize={table.getState().pagination.pageSize}
        onPageChange={(p) => {
          if (onPageChange) {
            onPageChange(p);
          } else {
            table.setPageIndex(p - 1);
          }
        }}
        onPageSizeChange={(size) => {
          if (onPageSizeChange) {
            onPageSizeChange(size);
          } else {
            table.setPageSize(size);
          }
        }}
      />
    </div>
  );
}
