"use client";

import { useState, useMemo, memo } from "react";
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
import { RecordDetailSheet } from "@/components/ui/record-detail-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Expand } from "lucide-react";
import type { DiscoverRow } from "@/lib/types/discover";
import type { ColumnMetadata } from "@/lib/types/discover";
import { cn, formatDateTime, formatDate } from "@/lib/utils";
import { TruncatedCell } from "@/components/monitoring";

interface DiscoverGridProps {
  rows: DiscoverRow[];
  columns: ColumnMetadata[];
  selectedColumns: string[];
  isLoading: boolean;
  // Pagination props
  page: number; // 1-indexed for display
  pageSize: number;
  totalHits: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const columnHelper = createColumnHelper<DiscoverRow>();

// Determine if a type is a datetime type (includes time)
function isDateTimeType(type: string): boolean {
  const base = type.replace(/^Nullable\(/, "").replace(/\)$/, "");
  return base.startsWith("DateTime");
}

// Determine if a type is a date-only type (no time)
function isDateOnlyType(type: string): boolean {
  const base = type.replace(/^Nullable\(/, "").replace(/\)$/, "");
  return base === "Date" || base === "Date32";
}

// Format cell value based on type
// Uses formatDateTime/formatDate from utils for proper timezone conversion
function formatCellValue(value: unknown, type: string): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }

  // Boolean - Keep generic badge style
  if (typeof value === "boolean") {
    return (
      <Badge variant={value ? "default" : "secondary"}>
        {value ? "true" : "false"}
      </Badge>
    );
  }

  // Determine styling
  let className = "";
  if (typeof value === "number")
    className = "text-right font-mono text-blue-600";

  // Convert to string for display
  let displayValue = String(value);

  // Object/Array - JSON stringify
  if (typeof value === "object") {
    displayValue = JSON.stringify(value);
  } else if (typeof value === "number") {
    displayValue = value.toLocaleString();
  }

  // Date/DateTime - convert timezone using standard utilities
  if (isDateTimeType(type) && typeof value === "string") {
    // DateTime columns: convert UTC to user's local timezone
    displayValue = formatDateTime(value);
  } else if (isDateOnlyType(type) && typeof value === "string") {
    // Date-only columns: format consistently
    displayValue = formatDate(value);
  }

  return (
    <TruncatedCell value={displayValue} className={className} maxWidth={300} />
  );
}

// Log level badge
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

// Import PaginationControls
import { PaginationControls } from "@/components/monitoring";

/**
 * Data grid for Discover results with dynamic columns
 *
 * Features:
 * - Dynamic column generation based on selected fields
 * - Smart cell formatting based on data type
 * - Sortable columns
 * - Row detail sheet for viewing full record
 * - Pagination controls
 */
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
}: DiscoverGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedRow, setSelectedRow] = useState<DiscoverRow | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Create column type lookup
  const columnTypes = useMemo(() => {
    const types: Record<string, string> = {};
    columnMetadata.forEach((col) => {
      types[col.name] = col.type;
    });
    return types;
  }, [columnMetadata]);

  // Convert columns to meta format for RecordDetailSheet
  const sheetColumns = useMemo(() => {
    return columnMetadata.map((col) => ({
      name: col.name,
      type: col.type,
    }));
  }, [columnMetadata]);

  // Generate table columns dynamically
  const tableColumns = useMemo(() => {
    // Determine which columns to show
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

            // Special handling for log level columns
            if (isLevel && typeof value === "string") {
              return getLevelBadge(value);
            }

            return formatCellValue(value, colType);
          },
        });
      }
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
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleRowClick = (row: DiscoverRow, index: number) => {
    setSelectedRow(row);
    setSelectedRowIndex(index);
    setSheetOpen(true);
  };

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading...
        </div>
      </div>
    );
  }

  if (!isLoading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data found. Try adjusting your filters or time range.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                  <TableHead className="w-8" />
                  {/* Expand icon column */}
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
                    selectedRow === row.original && sheetOpen && "bg-muted"
                  )}
                  onClick={() => handleRowClick(row.original, index)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="data-table-cell last:border-r-0"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
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

        {/* Pagination Controls */}
        <PaginationControls
          page={page}
          totalPages={Math.ceil(totalHits / pageSize)}
          totalItems={totalHits}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>

      {/* Row Detail Sheet - using RecordDetailSheet for consistency */}
      <RecordDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        record={selectedRow}
        columns={sheetColumns}
        title="Record Details"
        rowIndex={selectedRowIndex ?? undefined}
      />
    </>
  );
});
