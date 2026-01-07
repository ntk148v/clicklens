"use client";

import { Header } from "@/components/layout";
import { HistoryTab } from "@/components/queries";

export default function QueryHistoryPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Query History" />
      <div className="flex-1 p-4 overflow-hidden">
        <HistoryTab />
      </div>
    </div>
  );
}
