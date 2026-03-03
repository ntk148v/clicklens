"use client";

import { useState, useMemo, useCallback, memo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  getSortedRowModel,
  SortingState,
  ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecordDetailSheet } from "@/components/ui/record-detail-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Expand, Filter, FilterX } from "lucide-react";
import type { DiscoverRow } from "@/lib/types/discover";
import type { ColumnMetadata } from "@/lib/types/discover";
import { cn, formatDateTime, formatDate } from "@/lib/utils";
import { TruncatedCell } from "@/components/monitoring";
import { PaginationControls } from "@/components/monitoring";
import { DiscoverGridSkeleton } from "./DiscoverGridSkeleton";

interface DiscoverGridProps {
  rows: DiscoverRow[];
  columns: ColumnMetadata[];
  selectedColumns: string[];
  isLoading: boolean;
  page: number;
  pageSize: number;
  totalHits: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onFilterForValue?: (column: string, value: unknown) => void;
  onFilterOutValue?: (column: string, value: unknown) => void;
}

const columnHelper = createColumnHelper<DiscoverRow>();

function isDateTimeType(type: string): boolean {
  const base = type.replace(/^Nullable\(/, "").replace(/\)$/, "");
  return base.startsWith("DateTime");
}

function isDateOnlyType(type: string): boolean {
  const base = type.replace(/^Nullable\(/, "").replace(/\)$/, "");
  return base === "Date" || base === "Date32";
}

function formatCellValue(value: unknown, type: string): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }

  if (typeof value === "boolean") {
    return (
      <Badge variant={value ? "default" : "secondary"}>
        {value ? "true" : "false"}
      </Badge>
    );
  }

  let className = "";
  if (typeof value === "number")
    className = "text-right font-mono text-blue-600";

  let displayValue = String(value);

  if (typeof value === "object") {
    displayValue = JSON.stringify(value);
  } else if (typeof value === "number") {
    displayValue = value.toLocaleString();
  }

  if (isDateTimeType(type) && typeof value === "string") {
    displayValue = formatDateTime(value);
  } else if (isDateOnlyType(type) && typeof value === "string") {
    displayValue = formatDate(value);
  }

  return (
    <TruncatedCell value={displayValue} className={className} maxWidth={300} />
  );
}

function getLevelBadge(level: string) {
  const levelLower = level?.toLowerCase() || "";
  if (levelLower.includes("fatal") || levelLower.includes("critical")) {
    return (
      <Badge className="bg-red-500/20 text-red-600 border-red-500/30">
        {level}
      </Badge>
    );
  }
  if (levelLower.includes("error")) {
    return (
      <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">
        {level}
      </Badge>
    );
  }
  if (levelLower.includes("warn")) {
    return (
      <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
        {level}
      </Badge>
    );
  }
  if (levelLower.includes("info") || levelLower.includes("notice")) {
    return (
      <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">
        {level}
      </Badge>
    );
  }
  if (levelLower.includes("debug") || levelLower.includes("trace")) {
    return (
      <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/30">
        {level}
      </Badge>
    );
  }
  return <Badge variant="outline">{level}</Badge>;
}

interface CellContextMenuState {
  column: string;
  value: unknown;
  x: number;
  y: number;
}

export const DiscoverGrid = memo(function DiscoverGrid({
  rows,
  columns: columnMetadata,
  selectedColumns,
  isLoading,
  page,
  pageSize,
  totalHits,
  onPageChange,
  onPageSizeChange,
  onFilterForValue,
  onFilterOutValue,
}: DiscoverGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedRow, setSelectedRow] = useState<DiscoverRow | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<CellContextMenuState | null>(
    null,
  );

  const columnTypes = useMemo(() => {
    const types: Record<string, string> = {};
    columnMetadata.forEach((col) => {
      types[col.name] = col.type;
    });
    return types;
  }, [columnMetadata]);

  const sheetColumns = useMemo(() => {
    return columnMetadata.map((col) => ({
      name: col.name,
      type: col.type,
    }));
  }, [columnMetadata]);

  const handleCellContextMenu = useCallback(
    (e: React.MouseEvent, column: string, value: unknown) => {
      if (!onFilterForValue && !onFilterOutValue) return;
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ column, value, x: e.clientX, y: e.clientY });
    },
    [onFilterForValue, onFilterOutValue],
  );

  const tableColumns = useMemo(() => {
    const columnsToShow =
      selectedColumns.length > 0 ? selectedColumns : Object.keys(rows[0] || {});

    const cols: ColumnDef<DiscoverRow, unknown>[] = columnsToShow.map(
      (colName) => {
        const colType = columnTypes[colName] || "String";
        const isLevel =
          colName === "level" || colName === "type" || colName === "severity";

        return columnHelper.accessor((row) => row[colName], {
          id: colName,
          header: ({ column }) => (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 -ml-3 font-medium"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              {colName}
              <ArrowUpDown className="ml-1 h-3 w-3" />
            </Button>
          ),
          cell: (info) => {
            const value = info.getValue();

            if (isLevel && typeof value === "string") {
              return getLevelBadge(value);
            }

            return formatCellValue(value, colType);
          },
        });
      },
    );

    return cols;
  }, [selectedColumns, columnTypes, rows]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: {
      sorting,
      pagination: {
        pageIndex: page - 1,
        pageSize: pageSize,
      },
    },
    manualPagination: true,
    pageCount: Math.ceil(totalHits / pageSize),
    onSortingChange: setSorting,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleRowClick = (row: DiscoverRow, index: number) => {
    setSelectedRow(row);
    setSelectedRowIndex(index);
    setSheetOpen(true);
  };

  if (isLoading && rows.length === 0) {
    return <DiscoverGridSkeleton />;
  }

  if (!isLoading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data found. Try adjusting your filters or time range.
      </div>
    );
  }

  const displayValue = (val: unknown): string => {
    if (val === null || val === undefined) return "null";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="whitespace-nowrap relative group"
                      style={{
                        width: header.getSize(),
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1 bg-border cursor-col-resize select-none touch-none opacity-0 group-hover:opacity-100 transition-opacity",
                            header.column.getIsResizing() &&
                              "bg-primary opacity-100",
                          )}
                        />
                      )}
                    </TableHead>
                  ))}
                  <TableHead className="w-8" />
                </TableRow>
              ))}
            </TableHeader>
            <TableBody isLoading={isLoading}>
              {table.getRowModel().rows.map((row, index) => (
                <tr
                  key={row.id}
                  data-slot="table-row"
                  className={cn(
                    "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors cursor-pointer group",
                    selectedRow === row.original && sheetOpen && "bg-muted",
                  )}
                  onClick={() => handleRowClick(row.original, index)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="data-table-cell last:border-r-0"
                      onContextMenu={(e) =>
                        handleCellContextMenu(
                          e,
                          cell.column.id,
                          cell.getValue(),
                        )
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                  <td className="p-2 align-middle w-8 sticky right-0 bg-background group-hover:bg-muted/50 transition-colors">
                    <Expand className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                </tr>
              ))}
            </TableBody>
          </Table>
        </div>

        <PaginationControls
          page={page}
          totalPages={Math.ceil(totalHits / pageSize)}
          totalItems={totalHits}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>

      <RecordDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        record={selectedRow}
        columns={sheetColumns}
        title="Record Details"
        rowIndex={selectedRowIndex ?? undefined}
      />

      {/* Context menu for click-to-filter */}
      {contextMenu && (
        <DropdownMenu
          open={true}
          onOpenChange={(open) => {
            if (!open) setContextMenu(null);
          }}
        >
          <DropdownMenuTrigger asChild>
            <div
              className="fixed w-0 h-0"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" className="w-64">
            <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">
              <span className="font-medium">{contextMenu.column}</span>
              {" = "}
              <span className="font-mono">
                {displayValue(contextMenu.value)}
              </span>
            </div>
            <DropdownMenuSeparator />
            {onFilterForValue && (
              <DropdownMenuItem
                onClick={() => {
                  onFilterForValue(contextMenu.column, contextMenu.value);
                  setContextMenu(null);
                }}
              >
                <Filter className="mr-2 h-3.5 w-3.5" />
                Filter for value
              </DropdownMenuItem>
            )}
            {onFilterOutValue && (
              <DropdownMenuItem
                onClick={() => {
                  onFilterOutValue(contextMenu.column, contextMenu.value);
                  setContextMenu(null);
                }}
              >
                <FilterX className="mr-2 h-3.5 w-3.5" />
                Filter out value
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
});
