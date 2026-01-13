"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  VisibilityState,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TruncatedCell } from "@/components/ui/truncated-cell";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { JsonViewer } from "@/components/ui/json-viewer";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Maximize2 } from "lucide-react";
import type { LogEntry } from "@/lib/hooks/use-logs";

interface DiscoverGridProps {
  logs: LogEntry[];
  isLoading: boolean;
  visibleColumns: VisibilityState;
  onVisibleColumnsChange: (
    updaterOrValue:
      | VisibilityState
      | ((old: VisibilityState) => VisibilityState)
  ) => void;
}

const columnHelper = createColumnHelper<LogEntry>();

// Stylish badge colors for levels (reused logic)
function getLevelBadge(level: string) {
  const l = (level || "").toLowerCase();
  switch (l) {
    case "fatal":
      return <Badge className="bg-red-900 text-red-100 border-0">Fatal</Badge>;
    case "error":
      return <Badge className="bg-red-600 text-white border-0">Error</Badge>;
    case "warning":
      return (
        <Badge className="bg-yellow-500 text-yellow-950 border-0">Warn</Badge>
      );
    case "information":
    case "info":
      return <Badge className="bg-blue-500 text-white border-0">Info</Badge>;
    case "debug":
      return <Badge className="bg-gray-500 text-white border-0">Debug</Badge>;
    case "trace":
      return (
        <Badge className="bg-gray-400 text-gray-900 border-0">Trace</Badge>
      );
    default:
      return <Badge variant="outline">{level}</Badge>;
  }
}

export function DiscoverGrid({
  logs,
  isLoading,
  visibleColumns,
  onVisibleColumnsChange,
}: DiscoverGridProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const columns = useMemo(
    () => [
      columnHelper.accessor("timestamp", {
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-8 data-[state=open]:bg-accent"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              <span>Time</span>
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: (info) => {
          try {
            return new Date(info.getValue()).toLocaleTimeString();
          } catch {
            return info.getValue();
          }
        },
        enableHiding: false, // Always show time
      }),
      columnHelper.accessor("type", {
        header: "Level",
        cell: (info) => getLevelBadge(info.getValue()),
      }),
      columnHelper.accessor("component", {
        header: "Component",
        cell: (info) => (
          <TruncatedCell value={info.getValue()} maxWidth={120} />
        ),
      }),
      columnHelper.accessor("message", {
        header: "Message",
        cell: (info) => (
          <div className="max-w-[600px]">
            <TruncatedCell
              value={info.getValue()}
              maxWidth={600}
              className="font-mono text-xs"
            />
          </div>
        ),
        enableHiding: false,
      }),
      columnHelper.accessor("thread_name", {
        header: "Thread",
        cell: (info) => (
          <span className="text-xs text-muted-foreground">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("query_id", {
        header: "Query ID",
        cell: (info) => (
          <span className="text-xs font-mono text-muted-foreground">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("source_file", {
        header: "Source",
        cell: (info) => (
          <span className="text-xs text-muted-foreground">
            {info.getValue()}
          </span>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: logs,
    columns,
    state: {
      sorting,
      columnVisibility: visibleColumns,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: onVisibleColumnsChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <TableWrapper className="border-t-0 rounded-t-none">
        <Table>
          <TableHeader>
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
                {/* Actions column placeholder */}
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody isLoading={isLoading}>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer group"
                  onClick={() => setSelectedLog(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Maximize2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableWrapper>

      {/* Details Sheet */}
      <Sheet
        open={!!selectedLog}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <SheetContent className="min-w-[50vw] sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Log Details</SheetTitle>
          </SheetHeader>

          {selectedLog && (
            <div className="space-y-6">
              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs mb-1">
                    Timestamp
                  </div>
                  <div className="font-mono">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">
                    Level
                  </div>
                  <div>{getLevelBadge(selectedLog.type)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">
                    Component
                  </div>
                  <div className="font-mono">{selectedLog.component}</div>
                </div>
                {selectedLog.query_id && (
                  <div>
                    <div className="text-muted-foreground text-xs mb-1">
                      Query ID
                    </div>
                    <div className="font-mono text-xs">
                      {selectedLog.query_id}
                    </div>
                  </div>
                )}
              </div>

              {/* Message */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Message
                </div>
                <div className="p-3 bg-muted/30 rounded-md border text-sm font-mono whitespace-pre-wrap break-words">
                  {selectedLog.message}
                </div>
              </div>

              {/* Full JSON */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  All Fields
                </div>
                <div className="p-3 bg-muted/30 rounded-md border overflow-x-auto">
                  <JsonViewer data={selectedLog} />
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
