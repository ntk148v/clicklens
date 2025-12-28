"use client";

import { useSqlBrowserStore } from "@/lib/store/sql-browser";
import { useTabsStore } from "@/lib/store/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table2,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  HardDrive,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function TableSidebar() {
  const {
    tables,
    loadingTables,
    sidebarCollapsed,
    toggleSidebar,
    selectedDatabase,
  } = useSqlBrowserStore();
  
  const { addTableTab, tabs, activeTabId } = useTabsStore();

  // Find if current active tab is a table tab
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeTableName = activeTab?.type === "table" ? activeTab.table : null;

  const handleTableClick = (tableName: string) => {
    if (selectedDatabase) {
      addTableTab(selectedDatabase, tableName);
    }
  };

  if (sidebarCollapsed) {
    return (
      <div className="w-10 border-r flex flex-col items-center py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleSidebar}
          title="Expand sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-56 border-r flex flex-col bg-muted/30">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Tables
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={toggleSidebar}
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {!selectedDatabase ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Select a database
          </div>
        ) : loadingTables ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : tables.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No tables found
          </div>
        ) : (
          <div className="py-1">
            {tables.map((table) => (
              <button
                key={table.name}
                onClick={() => handleTableClick(table.name)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm hover:bg-accent/50 transition-colors",
                  activeTableName === table.name && "bg-accent"
                )}
              >
                <div className="flex items-center gap-2">
                  <Table2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="truncate font-medium">{table.name}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 ml-5 text-[10px] text-muted-foreground">
                  <span title="Rows">{formatNumber(table.total_rows)} rows</span>
                  <span className="flex items-center gap-0.5" title="Size">
                    <HardDrive className="w-2.5 h-2.5" />
                    {formatBytes(table.total_bytes)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
