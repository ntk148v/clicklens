"use client";

import { LogsViewer } from "@/components/logging/LogsViewer";
import { Header } from "@/components/layout/Header";

export default function SessionLogsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Session Logs" />
      <div className="p-6 flex-1 overflow-hidden">
        <LogsViewer source="session_log" />
      </div>
    </div>
  );
}
