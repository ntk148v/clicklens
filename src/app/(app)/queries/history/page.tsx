"use client";

import { Suspense } from "react";
import { Header } from "@/components/layout";
import { HistoryTab } from "@/components/queries";
import { Loader2 } from "lucide-react";

export default function QueryHistoryPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Query History" />
      <div className="flex-1 p-4 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <HistoryTab />
        </Suspense>
      </div>
    </div>
  );
}
