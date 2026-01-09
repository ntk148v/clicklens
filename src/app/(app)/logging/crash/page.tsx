"use client";

import { LogsViewer } from "@/components/logging/LogsViewer";
import { Header } from "@/components/layout/Header";

export default function CrashLogsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Crash Logs" />
      <div className="px-6 pt-6">
        <div className="p-4 rounded-lg bg-muted border">
          <p className="text-xs text-muted-foreground">
            Note: The <code className="text-primary">system.crash_log</code>{" "}
            table does not exist in the database by default, it is created only
            when fatal errors occur.
          </p>
        </div>
      </div>
      <div className="p-6 flex-1 overflow-hidden">
        <LogsViewer source="crash_log" />
      </div>
    </div>
  );
}
