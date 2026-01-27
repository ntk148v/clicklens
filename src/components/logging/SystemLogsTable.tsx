"use client";

import { useMemo } from "react";
import { VirtualizedDataTable } from "./VirtualizedDataTable";
import { Badge } from "@/components/ui/badge";
import { TruncatedCell } from "@/components/ui/truncated-cell";
import type { LogEntry } from "@/lib/hooks/use-logs";
import { formatDateTime } from "@/lib/utils";

interface SystemLogsTableProps {
  logs: LogEntry[];
  isLoading?: boolean;
}

// Stylish badge colors for 6 log levels
function getLevelBadge(level: string) {
  const l = level.toLowerCase();

  switch (l) {
    case "fatal":
      return (
        <Badge className="bg-red-900 text-red-100 hover:bg-red-900 border-0">
          Fatal
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-600 text-white hover:bg-red-600 border-0">
          Error
        </Badge>
      );
    case "warning":
      return (
        <Badge className="bg-yellow-500 text-yellow-950 hover:bg-yellow-500 border-0">
          Warning
        </Badge>
      );
    case "information":
    case "info":
      return (
        <Badge className="bg-blue-500 text-white hover:bg-blue-500 border-0">
          Info
        </Badge>
      );
    case "debug":
      return (
        <Badge className="bg-gray-500 text-white hover:bg-gray-500 border-0">
          Debug
        </Badge>
      );
    case "trace":
      return (
        <Badge className="bg-gray-400 text-gray-900 hover:bg-gray-400 border-0">
          Trace
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {level}
        </Badge>
      );
  }
}

export function SystemLogsTable({ logs, isLoading }: SystemLogsTableProps) {
  const columns = useMemo(
    () => [
      {
        header: "Time",
        width: 140, // Fixed width
        cell: (log: LogEntry) => (
          <div className="flex flex-col whitespace-nowrap">
            <span>{formatDateTime(log.timestamp)}</span>
          </div>
        ),
      },
      {
        header: "Level",
        width: 80,
        cell: (log: LogEntry) => getLevelBadge(log.type),
      },
      {
        header: "Component",
        width: 150,
        cell: (log: LogEntry) => (
          <TruncatedCell
            value={log.component}
            maxWidth={150}
            className="text-muted-foreground"
          />
        ),
      },
      {
        header: "Message",
        // width: 'auto', // Flex
        cell: (log: LogEntry) => (
          <div className="max-w-[600px]">
            <TruncatedCell
              value={log.message}
              maxWidth={800} // Increased max width since we have space
              className="font-mono text-xs"
            />
          </div>
        ),
      },
    ],
    [],
  );

  // Column definitions for the detailed sheet
  const sheetColumns = useMemo(
    () => [
      { name: "timestamp", type: "DateTime64" },
      { name: "type", type: "String" },
      { name: "component", type: "String" },
      { name: "message", type: "String" },
      { name: "details", type: "String" },
      { name: "event_time", type: "DateTime" },
      { name: "thread_name", type: "String" },
      { name: "query_id", type: "String" },
      { name: "source_file", type: "String" },
      { name: "source_line", type: "UInt64" },
    ],
    [],
  );

  return (
    <VirtualizedDataTable
      data={logs}
      columns={columns}
      isLoading={isLoading}
      estimateRowHeight={40}
      emptyMessage="No logs found"
      enableRecordDetails={true}
      sheetColumns={sheetColumns}
      sheetTitle="Log Details"
    />
  );
}
