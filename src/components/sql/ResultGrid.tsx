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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  data: Record<string, unknown>[];
  meta: ColumnMeta[];
  statistics?: QueryStatistics;
  totalRows?: number;
  className?: string;
}

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
}: ResultGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    return meta.map((col) => ({
      id: col.name,
      accessorKey: col.name,
      header: ({ column }) => (
        <div className="flex items-center gap-1">
          <span className="font-semibold">{col.name}</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1 py-0 font-mono text-muted-foreground"
          >
            {col.type}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto"
            onClick={() => column.toggleSorting()}
          >
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="h-3 w-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue();
        return (
          <span
            className={cn(
              "truncate block max-w-[300px]",
              getCellClassName(value)
            )}
          >
            {formatCellValue(value)}
          </span>
        );
      },
      size: 150,
      minSize: 80,
    }));
  }, [meta]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode,
    initialState: {
      pagination: {
        pageSize: 100,
      },
    },
  });

  const copyToClipboard = async () => {
    const headers = meta.map((c) => c.name).join("\t");
    const rows = data.map((row) =>
      meta.map((c) => formatCellValue(row[c.name])).join("\t")
    );
    const text = [headers, ...rows].join("\n");
    await navigator.clipboard.writeText(text);
  };

  const downloadCsv = () => {
    const headers = meta.map((c) => `"${c.name}"`).join(",");
    const rows = data.map((row) =>
      meta
        .map((c) => {
          const value = formatCellValue(row[c.name]);
          return `"${value.replace(/"/g, '""')}"`;
        })
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
              onClick={copyToClipboard}
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

      {/* Table */}
      <ScrollArea className="flex-1">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="font-semibold whitespace-nowrap"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/50">
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="py-1.5 px-4 font-mono text-sm"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs">
        <div className="text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
