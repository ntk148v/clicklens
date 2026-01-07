"use client";

import { Header } from "@/components/layout";
import { CacheTab } from "@/components/queries";

export default function QueryCachePage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Query Cache" />
      <div className="flex-1 p-4 overflow-hidden">
        <CacheTab />
      </div>
    </div>
  );
}
