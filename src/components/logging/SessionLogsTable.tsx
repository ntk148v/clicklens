"use client";

import { useMemo } from "react";
import { VirtualizedDataTable } from "./VirtualizedDataTable";
import { Badge } from "@/components/ui/badge";
import { TruncatedCell } from "@/components/ui/truncated-cell";
import type { LogEntry } from "@/lib/hooks/use-logs";
import { formatDateTime } from "@/lib/utils";

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
      {
        header: "Time",
        width: 140,
        cell: (log: LogEntry) => (
          <div className="flex flex-col whitespace-nowrap">
            <span>{formatDateTime(log.timestamp)}</span>
          </div>
        ),
      },
      {
        header: "Event Type",
        width: 120,
        cell: (log: LogEntry) => getEventTypeBadge(log.type),
      },
      {
        header: "User",
        width: 150,
        cell: (log: LogEntry) => (
          <div className="text-secondary-foreground font-medium">
            {log.component}
          </div>
        ),
      },
      {
        header: "Message",
        // width: 'auto',
        cell: (log: LogEntry) => (
          <div className="max-w-[600px]">
            <TruncatedCell
              value={log.message}
              maxWidth={800}
              className="font-mono text-xs"
            />
          </div>
        ),
      },
      // Hidden columns for RecordDetailSheet
      // Not actually hidden, the Sheet uses them if they are in the 'data'.
      // Wait, ClickableTableRow uses specific `columns` prop for the sheet content which is separate from visual table columns in my new wrapper?
      // In my `VirtualizedDataTable`:
      // const recordColumns = columns.map(...) -> this just maps visual columns.
      // If we want FULL details in the sheet (e.g. query_id, thread_name), we need to ensure they are available or passed differently.
      // The current implementation of `VirtualizedDataTable` with `enableRecordDetails={true}` uses the VISUAL columns for the sheet.
      // This is a REGRESSION if we want to show fields that are NOT in the table.
      // I should update VirtualizedDataTable to accept `sheetColumns` or similar.
      // For now, let's stick to visual parity.
      // Actually, looking at `VirtualizedDataTable` I implemented:
      /*
        const recordColumns = columns.map((c, i) => ({
                name: i.toString(),
                type: 'string', // dummy
        }));
      */
      // This is definitely broken for the sheet, as it won't show proper keys/values.
      // I need to fix `VirtualizedDataTable` to better support the Sheet.
    ],
    [],
  );

  // Sheet columns
  const sheetColumns = useMemo(
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
    [],
  );

  return (
    <VirtualizedDataTable
      data={logs}
      columns={columns}
      isLoading={isLoading}
      estimateRowHeight={40}
      emptyMessage="No session logs found"
      enableRecordDetails={true}
      sheetColumns={sheetColumns}
      sheetTitle="Session Detail"
    />
  );
}
