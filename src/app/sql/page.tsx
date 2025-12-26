"use client";

import { useEffect, useCallback, useState } from "react";
import { Header } from "@/components/layout";
import {
  SqlEditor,
  ResultGrid,
  QueryTabs,
  QueryHistory,
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
import {
  Play,
  Square,
  FileText,
  History,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { QueryResponse } from "@/app/api/clickhouse/query/route";

export default function SqlConsolePage() {
  const { tabs, activeTabId, updateTab, getActiveTab, addToHistory } =
    useTabsStore();
  const [historyOpen, setHistoryOpen] = useState(false);

  // Initialize tabs on first load
  useEffect(() => {
    initializeTabs();
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleExecute = useCallback(async () => {
    const tab = getActiveTab();
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
  }, [getActiveTab, updateTab, addToHistory]);

  const handleSqlChange = useCallback(
    (value: string) => {
      if (activeTabId) {
        updateTab(activeTabId, { sql: value });
      }
    },
    [activeTabId, updateTab]
  );

  const handleHistorySelect = useCallback(
    (sql: string) => {
      if (activeTabId) {
        updateTab(activeTabId, { sql });
        setHistoryOpen(false);
      }
    },
    [activeTabId, updateTab]
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="SQL Console">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-ch-yellow text-ch-bg hover:bg-ch-amber"
            onClick={handleExecute}
            disabled={!activeTab || activeTab.isRunning}
          >
            {activeTab?.isRunning ? (
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

          <Separator orientation="vertical" className="h-6 bg-ch-border" />

          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="text-ch-muted">
                <History className="w-4 h-4 mr-1" />
                History
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] bg-ch-bg border-ch-border p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Query History</SheetTitle>
              </SheetHeader>
              <QueryHistory onSelect={handleHistorySelect} />
            </SheetContent>
          </Sheet>
        </div>
      </Header>

      {/* Tabs */}
      <QueryTabs />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTab ? (
          <>
            {/* Editor */}
            <div className="h-[250px] p-4 border-b border-ch-border">
              <SqlEditor
                value={activeTab.sql}
                onChange={handleSqlChange}
                onExecute={handleExecute}
                readOnly={activeTab.isRunning}
              />
            </div>

            {/* Result area */}
            <div className="flex-1 min-h-0">
              {activeTab.error ? (
                <div className="flex items-start gap-3 p-4 m-4 rounded-md bg-status-error/10 border border-status-error/20">
                  <AlertCircle className="w-5 h-5 text-status-error flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-status-error">
                      {activeTab.error.userMessage}
                    </p>
                    <pre className="mt-2 text-xs text-ch-muted font-mono whitespace-pre-wrap break-all overflow-x-auto">
                      {activeTab.error.message}
                    </pre>
                  </div>
                </div>
              ) : activeTab.result ? (
                <ResultGrid
                  data={activeTab.result.data}
                  meta={activeTab.result.meta}
                  statistics={activeTab.result.statistics}
                  totalRows={
                    activeTab.result.rows_before_limit_at_least ||
                    activeTab.result.rows
                  }
                  className="h-full"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-ch-muted">
                  <FileText className="w-12 h-12 mb-4 opacity-30" />
                  <p className="text-sm">No results yet</p>
                  <p className="text-xs mt-1">
                    Press{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-ch-surface border border-ch-border font-mono text-xs">
                      Ctrl
                    </kbd>
                    +
                    <kbd className="px-1.5 py-0.5 rounded bg-ch-surface border border-ch-border font-mono text-xs">
                      Enter
                    </kbd>{" "}
                    to run your query
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-ch-muted">
            <p>No active query tab</p>
          </div>
        )}
      </div>
    </div>
  );
}
