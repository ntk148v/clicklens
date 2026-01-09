"use client";

import { LogsViewer } from "@/components/logging/LogsViewer";
import { Header } from "@/components/layout/Header";

export default function CrashLogsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Crash Logs" />
      <div className="px-6 pt-6">
        <LogsViewer source="crash_log" />
      </div>
    </div>
  );
}
