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
  TableWrapper,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TruncatedCell } from "@/components/ui/truncated-cell";
import type { LogEntry } from "@/lib/hooks/use-logs";

interface SessionLogsTableProps {
  logs: LogEntry[];
  isLoading?: boolean;
}

// Badge colors for session event types
function getEventTypeBadge(type: string) {
  // Common event types: SessionStart, SessionLogout, LoginFailure, etc.
  // Using loose matching or exact matching based on observed values.

  if (type.includes("Failure")) {
    return (
      <Badge className="bg-red-600 text-white hover:bg-red-600 border-0">
        {type}
      </Badge>
    );
  }

  if (type === "LoginSuccess") {
    return (
      <Badge className="bg-green-600 text-white hover:bg-green-600 border-0">
        {type}
      </Badge>
    );
  }

  if (type === "Logout") {
    return (
      <Badge className="bg-gray-500 text-white hover:bg-gray-500 border-0">
        {type}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-muted-foreground">
      {type}
    </Badge>
  );
}

export function SessionLogsTable({ logs, isLoading }: SessionLogsTableProps) {
  const columns = useMemo(
    () => [
      { name: "timestamp", type: "DateTime" },
      { name: "type", type: "String" },
      { name: "component", type: "String" }, // User
      { name: "message", type: "String" },
      { name: "details", type: "String" },
      { name: "event_time", type: "DateTime" },
      { name: "thread_name", type: "String" },
      { name: "query_id", type: "String" },
    ],
    []
  );

  const formatDate = (ts: string) => {
    try {
      const datePart = ts.split(" ")[0] || ts.split("T")[0];
      return datePart;
    } catch {
      return "";
    }
  };

  return (
    <TableWrapper>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Time</TableHead>
            <TableHead className="w-[120px]">Event Type</TableHead>
            <TableHead className="w-[150px]">User</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody isLoading={isLoading}>
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <ClickableTableRow
                key={`${log.timestamp}_${index}`}
                record={log as unknown as Record<string, unknown>}
                columns={columns}
                rowIndex={index}
                sheetTitle="Session Detail"
              >
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  <div className="flex flex-col">
                    <span>{log.timestamp}</span>
                  </div>
                </TableCell>
                <TableCell>{getEventTypeBadge(log.type)}</TableCell>
                <TableCell className="font-mono text-xs text-secondary-foreground font-medium">
                  {log.component}
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
                No session logs found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}
