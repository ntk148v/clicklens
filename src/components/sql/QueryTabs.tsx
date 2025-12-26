"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, X, Terminal } from "lucide-react";
import { useTabsStore } from "@/lib/store/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export function QueryTabs() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab } = useTabsStore();

  return (
    <div className="flex items-center h-10 bg-ch-bg border-b border-ch-border">
      <ScrollArea className="flex-1">
        <div className="flex items-center h-10">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "group flex items-center gap-2 h-10 px-4 border-r border-ch-border cursor-pointer transition-colors",
                tab.id === activeTabId
                  ? "bg-ch-surface text-ch-text"
                  : "text-ch-muted hover:text-ch-text hover:bg-ch-surface/50"
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <Terminal
                className={cn(
                  "w-3.5 h-3.5",
                  tab.isRunning && "animate-pulse text-ch-yellow"
                )}
              />
              <span className="text-sm font-medium whitespace-nowrap max-w-[120px] truncate">
                {tab.name}
              </span>
              {tabs.length > 1 && (
                <button
                  className="opacity-0 group-hover:opacity-100 hover:text-status-error transition-opacity p-0.5 -mr-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTab(tab.id);
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-1" />
      </ScrollArea>

      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-none border-l border-ch-border text-ch-muted hover:text-ch-text"
        onClick={() => addTab()}
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}
