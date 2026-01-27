"use client";

import React, { useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ClickableTableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface VirtualizedDataTableProps<T> {
  data: T[];
  columns: {
    header: React.ReactNode;
    cell: (item: T) => React.ReactNode;
    width?: number | string;
    align?: "left" | "center" | "right";
    className?: string;
  }[];
  estimateRowHeight?: number;
  isLoading?: boolean;
  emptyMessage?: React.ReactNode;

  // Row Interaction
  onRowClick?: (item: T) => void;
  getRowId?: (item: T, index: number) => string;

  // Infinite Scroll Wrappers
  onEndReached?: () => void;
  // endReachedThreshold?: number; // Removed unused prop

  // Additional content
  headerContent?: React.ReactNode;
  footerContent?: React.ReactNode;

  // Sheet Metadata
  sheetColumns?: { name: string; type: string }[];
  sheetTitle?: string;
  enableRecordDetails?: boolean;

  className?: string;
}

export function VirtualizedDataTable<T extends object>({
  data,
  columns,
  estimateRowHeight = 40,
  isLoading = false,
  emptyMessage = "No data found",
  onRowClick,
  getRowId,
  onEndReached,
  // endReachedThreshold = 200, // Unused
  headerContent,
  footerContent,
  className,
  enableRecordDetails = false,
  sheetColumns = [],
  sheetTitle = "Record Details",
}: VirtualizedDataTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const count = data.length;
  const getScrollElement = React.useCallback(() => parentRef.current, []);
  const estimateSize = React.useCallback(
    () => estimateRowHeight,
    [estimateRowHeight],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count,
    getScrollElement,
    estimateSize,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Handle Infinite Scroll
  useEffect(() => {
    if (!onEndReached || !virtualItems.length || isLoading) return;

    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem.index >= count - 1) {
      onEndReached();
    }
  }, [virtualItems, count, isLoading, onEndReached]);

  // If no data
  const isEmpty = count === 0;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {headerContent}

      {/* Table Header - Sticky outside virtual scroll */}
      <div className="border rounded-t-md border-b-0 overflow-hidden flex-none">
        <Table>
          <TableHeader className="bg-background">
            <TableRow className="hover:bg-transparent">
              {columns.map((col, i) => (
                <TableHead
                  key={i}
                  className={cn(col.className)}
                  style={{ width: col.width }}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto border-x border-b rounded-b-md relative"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          <Table
            className="absolute top-0 left-0 w-full"
            style={{
              transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
            }}
          >
            {/* Invisible header to force column widths matching the sticky header */}
            <TableHeader className="opacity-0 pointer-events-none invisible">
              <TableRow>
                {columns.map((col, i) => (
                  <TableHead
                    key={i}
                    className={cn(col.className)}
                    style={{ width: col.width }}
                  />
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {isEmpty && !isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}

              {virtualItems.map((virtualRow) => {
                const item = data[virtualRow.index];
                const rowKey = getRowId
                  ? getRowId(item, virtualRow.index)
                  : virtualRow.index;

                // If using standard clickable row functionality
                if (enableRecordDetails) {
                  return (
                    <ClickableTableRow
                      key={rowKey}
                      record={item}
                      rowIndex={virtualRow.index}
                      columns={sheetColumns} // Use FULL sheet metadata
                      sheetTitle={sheetTitle}
                      data-index={virtualRow.index}
                      ref={virtualizer.measureElement}
                      className={cn("w-full")}
                    >
                      {columns.map((col, i) => (
                        <TableCell
                          key={i}
                          className={cn("data-table-cell", col.className)}
                          style={{ width: col.width }}
                        >
                          {col.cell(item)}
                        </TableCell>
                      ))}
                    </ClickableTableRow>
                  );
                }

                return (
                  <TableRow
                    key={rowKey}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className={cn(
                      onRowClick ? "cursor-pointer hover:bg-muted/50" : "",
                    )}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map((col, i) => (
                      <TableCell
                        key={i}
                        className={cn("data-table-cell", col.className)}
                        style={{ width: col.width }}
                      >
                        {col.cell(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {isLoading && (
          <div className="absolute inset-x-0 bottom-0 p-2 text-center bg-background/80 backdrop-blur border-t text-xs text-muted-foreground">
            Loading more...
          </div>
        )}
      </div>

      {footerContent}
    </div>
  );
}
