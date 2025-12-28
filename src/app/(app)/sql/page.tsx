"use client";

import { useEffect, useCallback, useState } from "react";
import { Header } from "@/components/layout";
import {
  SqlEditor,
  ResultGrid,
  QueryTabs,
  QueryHistory,
  DatabaseSelector,
  TableSidebar,
  TablePreview,
} from "@/components/sql";
import { useTabsStore, initializeTabs } from "@/lib/store/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Play, FileText, History, AlertCircle, Loader2 } from "lucide-react";
import type { QueryResponse } from "@/app/api/clickhouse/query/route";

export default function SqlConsolePage() {
  const { tabs, activeTabId, updateTab, getActiveQueryTab, addToHistory } =
    useTabsStore();
  const [historyOpen, setHistoryOpen] = useState(false);

  // Initialize tabs on first load
  useEffect(() => {
    initializeTabs();
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeQueryTab = activeTab?.type === "query" ? activeTab : null;

  const handleExecute = useCallback(async () => {
    const tab = getActiveQueryTab();
    if (!tab || tab.isRunning) return;

    const sql = tab.sql.trim();
    if (!sql) return;

    updateTab(tab.id, { isRunning: true, error: null });

    try {
      const response = await fetch("/api/clickhouse/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql }),
      });

      const data: QueryResponse = await response.json();

      if (data.success && data.data && data.meta && data.statistics) {
        updateTab(tab.id, {
          isRunning: false,
          result: {
            data: data.data as Record<string, unknown>[],
            meta: data.meta,
            rows: data.rows!,
            rows_before_limit_at_least: data.rows_before_limit_at_least,
            statistics: data.statistics,
          },
          error: null,
        });

        addToHistory({
          sql,
          duration: data.statistics.elapsed,
          rowsReturned: data.rows,
        });
      } else {
        updateTab(tab.id, {
          isRunning: false,
          result: null,
          error: data.error || {
            code: 0,
            message: "Unknown error",
            type: "unknown",
            userMessage: "An unexpected error occurred",
          },
        });

        addToHistory({
          sql,
          error: data.error?.userMessage || "Error",
        });
      }
    } catch (error) {
      updateTab(tab.id, {
        isRunning: false,
        result: null,
        error: {
          code: 0,
          message: error instanceof Error ? error.message : "Unknown error",
          type: "network",
          userMessage: "Failed to connect to server",
        },
      });

      addToHistory({
        sql,
        error: "Network error",
      });
    }
  }, [getActiveQueryTab, updateTab, addToHistory]);

  const handleSqlChange = useCallback(
    (value: string) => {
      if (activeTabId && activeQueryTab) {
        updateTab(activeTabId, { sql: value });
      }
    },
    [activeTabId, activeQueryTab, updateTab]
  );

  const handleHistorySelect = useCallback(
    (sql: string) => {
      if (activeTabId && activeQueryTab) {
        updateTab(activeTabId, { sql });
        setHistoryOpen(false);
      }
    },
    [activeTabId, activeQueryTab, updateTab]
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="SQL Console">
        <div className="flex items-center gap-2">
          <DatabaseSelector />

          <Separator orientation="vertical" className="h-6" />

          <Button
            size="sm"
            onClick={handleExecute}
            disabled={!activeQueryTab || activeQueryTab.isRunning}
          >
            {activeQueryTab?.isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" />
                Run
              </>
            )}
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                <History className="w-4 h-4 mr-1" />
                History
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Query History</SheetTitle>
              </SheetHeader>
              <QueryHistory onSelect={handleHistorySelect} />
            </SheetContent>
          </Sheet>
        </div>
      </Header>

      {/* Main layout with sidebar */}
      <div className="flex-1 flex min-h-0">
        {/* Table sidebar */}
        <TableSidebar />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Query Tabs */}
          <QueryTabs />

          {/* Content based on active tab type */}
          <div className="flex-1 flex flex-col min-h-0">
            {activeTab?.type === "table" ? (
              <TablePreview
                database={activeTab.database}
                table={activeTab.table}
              />
            ) : activeQueryTab ? (
              <>
                {/* Editor */}
                <div className="h-[200px] p-4 border-b">
                  <SqlEditor
                    value={activeQueryTab.sql}
                    onChange={handleSqlChange}
                    onExecute={handleExecute}
                    readOnly={activeQueryTab.isRunning}
                  />
                </div>

                {/* Result area */}
                <div className="flex-1 min-h-0">
                  {activeQueryTab.error ? (
                    <div className="flex items-start gap-3 p-4 m-4 rounded-md bg-red-50 border border-red-200 dark:bg-red-950/50 dark:border-red-900">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-red-800 dark:text-red-300">
                          {activeQueryTab.error.userMessage}
                        </p>
                        <pre className="mt-2 text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                          {activeQueryTab.error.message}
                        </pre>
                      </div>
                    </div>
                  ) : activeQueryTab.result ? (
                    <ResultGrid
                      data={activeQueryTab.result.data}
                      meta={activeQueryTab.result.meta}
                      statistics={activeQueryTab.result.statistics}
                      totalRows={
                        activeQueryTab.result.rows_before_limit_at_least ||
                        activeQueryTab.result.rows
                      }
                      className="h-full"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <FileText className="w-12 h-12 mb-4 opacity-30" />
                      <p className="text-sm">No results yet</p>
                      <p className="text-xs mt-1">
                        Press{" "}
                        <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-xs">
                          Ctrl
                        </kbd>
                        +
                        <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono text-xs">
                          Enter
                        </kbd>{" "}
                        to run your query
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No active tab</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
