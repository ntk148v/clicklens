"use client";

import { useMemo, useState, memo, useCallback, useRef, useEffect } from "react";
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
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Table,
  TableHeader,
  SortableTableHead,
  TableRow,
  ClickableTableRow,
  TableWrapper,
  type RowData,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { cn, copyToClipboard, formatDateTime } from "@/lib/utils";
import { PaginationControls, TruncatedCell } from "@/components/monitoring";
import { DEFAULT_ROW_HEIGHT, DEFAULT_OVERSCAN } from "@/lib/virtual/virtual.config";
import { useGridAccessibility } from "@/components/virtual/accessibility";
import {
  type CellSelection,
  isCellInSelection,
  extractSelectedCells,
  selectionToTsv,
  isCopyShortcut,
  validateSelection,
  formatCellValueForCopy,
} from "@/lib/virtual/edge-cases";

interface ColumnMeta {
  name: string;
  type: string;
}

interface QueryStatistics {
  elapsed: number;
  rows_read: number;
  bytes_read: number;
}

interface VirtualizedResultGridProps {
  data: unknown[];
  meta: ColumnMeta[];
  statistics?: QueryStatistics;
  totalRows?: number;
  className?: string;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  isLoading?: boolean;
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

function formatDuration(seconds: number | string): string {
  const val = Number(seconds);
  if (isNaN(val) || seconds == null) return "0s";
  if (val < 0.001) return `${(val * 1000000).toFixed(0)}µs`;
  if (val < 1) return `${(val * 1000).toFixed(2)}ms`;
  return `${val.toFixed(3)}s`;
}

function getRowValue(row: unknown, columnName: string, columnIndex: number): unknown {
  if (Array.isArray(row)) {
    return row[columnIndex];
  }
  return (row as Record<string, unknown>)[columnName];
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);

  if (typeof value === "string") {
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

export const VirtualizedResultGrid = memo(function VirtualizedResultGrid({
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
}: VirtualizedResultGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");
  const [cellSelection, setCellSelection] = useState<CellSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<unknown>[]>(() => {
    return meta.map((col, idx) => ({
      id: `${String(col.name)}_${idx}`,
      accessorFn: (row: unknown) => {
        if (Array.isArray(row)) return row[idx];
        return (row as Record<string, unknown>)[col.name];
      },
      header: () => (
        <span className="font-semibold">{col.name}</span>
      ),
      cell: ({ getValue }) => {
        const value = getValue();
        return (
          <TruncatedCell
            value={formatCellValue(value)}
            className={getCellClassName(value)}
            maxWidth={280}
          />
        );
      },
size: 180,
          minSize: 100,
          maxSize: 600,
          enableResizing: true,
    }));
  }, [meta]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination: {
        pageIndex: page,
        pageSize: pageSize,
      },
    },
    manualPagination: !!onPageChange,
    pageCount: totalRows ? Math.ceil(totalRows / pageSize) : -1,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode,
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => DEFAULT_ROW_HEIGHT,
    overscan: DEFAULT_OVERSCAN,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const accessibility = useGridAccessibility({
    rowCount: rows.length,
    columnCount: columns.length,
    scrollToRow: (rowIndex) => {
      rowVirtualizer.scrollToIndex(rowIndex);
    },
  });

  const handleCopyToClipboard = useCallback(async () => {
    const headers = meta.map((c) => c.name).join("\t");
    const rows = data.map((row) =>
      meta
        .map((c, idx) => formatCellValue(getRowValue(row, c.name, idx)))
        .join("\t")
    );
    const text = [headers, ...rows].join("\n");
    await copyToClipboard(text);
  }, [data, meta]);

  const downloadCsv = useCallback(() => {
    const headers = meta.map((c) => `"${c.name}"`).join(",");
    const rows = data.map((row) =>
      meta
        .map((c, idx) => formatCellValue(getRowValue(row, c.name, idx)))
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
  }, [data, meta]);

  const handleCellMouseDown = useCallback(
    (rowIndex: number, colIndex: number) => {
      setIsSelecting(true);
      setCellSelection({
        startRow: rowIndex,
        endRow: rowIndex,
        startCol: colIndex,
        endCol: colIndex,
      });
    },
    []
  );

  const handleCellMouseEnter = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!isSelecting || !cellSelection) return;
      setCellSelection((prev) =>
        prev
          ? {
              ...prev,
              endRow: rowIndex,
              endCol: colIndex,
            }
          : null
      );
    },
    [isSelecting, cellSelection]
  );

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
  }, []);

  const handleCopySelection = useCallback(async () => {
    if (!cellSelection) return;

    const validated = validateSelection(
      cellSelection,
      data.length,
      meta.length
    );
    const columnNames = meta.map((c) => c.name);
    const selectedData = extractSelectedCells(
      data,
      columnNames,
      validated,
      (row, column, colIndex) => getRowValue(row, column, colIndex)
    );
    const tsv = selectionToTsv(selectedData);
    await copyToClipboard(tsv);
  }, [cellSelection, data, meta]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCopyShortcut(e) && cellSelection) {
        e.preventDefault();
        handleCopySelection();
      }
    };

    const handleGlobalMouseUp = () => {
      setIsSelecting(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [cellSelection, handleCopySelection]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No results
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
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
        <div
          ref={tableContainerRef}
          className="flex-1 overflow-auto"
          style={{ contain: "strict" }}
        >
          <div
            style={{ height: `${totalSize}px`, width: "100%", position: "relative" }}
            {...accessibility.getGridProps()}
          >
            <table className="w-full caption-bottom text-sm" role="presentation" style={{ tableLayout: 'auto' }}>
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
              <tbody
                data-slot="table-body"
                className={cn(
                  "[&_tr:last-child]:border-0",
                  isLoading &&
                    "opacity-50 pointer-events-none select-none transition-opacity duration-200"
                )}
              >
                {(() => {
                    const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
                    const paddingBottom = virtualRows.length > 0
                      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
                      : 0;

                    return (
                      <>
                        {paddingTop > 0 && (
                          <tr>
                            <td
                              style={{ height: `${paddingTop}px` }}
                              colSpan={columns.length}
                            />
                          </tr>
                        )}
                        {virtualRows.map((virtualRow) => {
                          const row = rows[virtualRow.index];
                          const displayIndex = onPageChange
                            ? page * pageSize + virtualRow.index
                            : virtualRow.index;
                          return (
                            <ClickableTableRow
                              key={row.id}
                              data-index={virtualRow.index}
                              record={data[virtualRow.index] as RowData}
                              columns={meta}
                              rowIndex={displayIndex}
                              sheetTitle="Query Result"
                              style={{ height: `${virtualRow.size}px` }}
                              {...accessibility.getRowProps(virtualRow.index)}
                            >
                      {row.getVisibleCells().map((cell, cellIndex) => {
                        const isSelected = isCellInSelection(
                          virtualRow.index,
                          cellIndex,
                          cellSelection
                        );
                        const cellProps = accessibility.getCellProps(virtualRow.index, cellIndex);
                        return (
                          <td
                            key={cell.id}
                            data-slot="table-cell"
                            className={cn(
                              "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] font-mono cursor-cell select-none",
                              isSelected && "bg-primary/20 ring-1 ring-inset ring-primary"
                            )}
                            onMouseDown={() =>
                              handleCellMouseDown(virtualRow.index, cellIndex)
                            }
                            onMouseEnter={() =>
                              handleCellMouseEnter(virtualRow.index, cellIndex)
                            }
                            onMouseUp={handleMouseUp}
                            {...cellProps}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </ClickableTableRow>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td
                      style={{ height: `${paddingBottom}px` }}
                      colSpan={columns.length}
                    />
                  </tr>
                )}
              </>
              );
            })()}
              </tbody>
            </table>
          </div>
        </div>
      </TableWrapper>

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
});
