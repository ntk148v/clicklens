"use client";

import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ClickableTableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TruncatedCell } from "@/components/ui/truncated-cell";
import type { LogEntry } from "@/lib/hooks/use-logs";
import { cn } from "@/lib/utils";

interface SystemLogsTableProps {
  logs: LogEntry[];
  isLoading: boolean;
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
    []
  );

  // Format timestamp for display
  const formatTime = (ts: string) => {
    try {
      // Handle ClickHouse DateTime64 format
      const date = new Date(ts);
      if (isNaN(date.getTime())) return ts;
      return date.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      });
    } catch {
      return ts;
    }
  };

  const formatDate = (ts: string) => {
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Loading logs...
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[140px]">Time</TableHead>
          <TableHead className="w-[80px]">Level</TableHead>
          <TableHead className="w-[150px]">Component</TableHead>
          <TableHead>Message</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <ClickableTableRow
              key={`${log.timestamp}_${index}`}
              record={log as any}
              columns={columns}
              rowIndex={index}
              sheetTitle="Log Details"
            >
              <TableCell className="font-mono text-xs whitespace-nowrap">
                <div className="flex flex-col">
                  <span>{formatTime(log.timestamp)}</span>
                  <span className="text-muted-foreground text-[10px]">
                    {formatDate(log.timestamp)}
                  </span>
                </div>
              </TableCell>
              <TableCell>{getLevelBadge(log.type)}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                <TruncatedCell value={log.component} maxWidth={150} />
              </TableCell>
              <TableCell>
                <div className="max-w-[600px]">
                  <TruncatedCell
                    value={log.message}
                    maxWidth={600}
                    className="font-mono text-xs"
                  />
                </div>
              </TableCell>
            </ClickableTableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={4} className="h-24 text-center">
              No logs found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
