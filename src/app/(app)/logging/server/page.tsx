"use client";

import { LogsViewer } from "@/components/logging/LogsViewer";
import { Header } from "@/components/layout/Header";

export default function ServerLogsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Server Logs" />
      <div className="p-6 flex-1 overflow-hidden">
        <LogsViewer source="text_log" />
      </div>
    </div>
  );
}
