"use client";

import { Header } from "@/components/layout";
import { AnalyticsTab } from "@/components/queries";

export default function QueryAnalyticsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Query Analytics" />
      <div className="flex-1 p-4 overflow-hidden">
        <AnalyticsTab />
      </div>
    </div>
  );
}
