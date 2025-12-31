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
  SavedQueries,
  SaveQueryDialog,
} from "@/components/sql";
import { useTabsStore, initializeTabs } from "@/lib/store/tabs";
import { useAuth } from "@/components/auth";
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
  FileText,
  History,
  AlertCircle,
  Loader2,
  Square,
  Bookmark,
  Save,
} from "lucide-react";
import type { QueryResponse } from "@/app/api/clickhouse/query/route";

export default function SqlConsolePage() {
  const { tabs, activeTabId, updateTab, getActiveQueryTab, addToHistory } =
    useTabsStore();
  const { user } = useAuth();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedQueriesOpen, setSavedQueriesOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

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

    // Import splitter dynamically to avoid SSR issues
    const { splitSqlStatements } = await import("@/lib/sql");
    const statements = splitSqlStatements(sql);

    if (statements.length === 0) return;

    const queryId = crypto.randomUUID();
    updateTab(tab.id, { isRunning: true, error: null, queryId });

    let lastSelectResult: QueryResponse | null = null;
    let executedCount = 0;
    let totalElapsed = 0;

    try {
      for (const statement of statements) {
        // Check if cancelled
        const currentTab = getActiveQueryTab();
        if (!currentTab || currentTab.id !== tab.id || !currentTab.isRunning) {
          return;
        }

        const response = await fetch("/api/clickhouse/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sql: statement, query_id: queryId }),
        });

        const data: QueryResponse = await response.json();

        if (!data.success) {
          // Statement failed, show error and stop
          updateTab(tab.id, {
            isRunning: false,
            result: null,
            error: data.error || {
              code: 0,
              message: `Failed at statement ${executedCount + 1}`,
              type: "unknown",
              userMessage: `Statement ${executedCount + 1} failed`,
            },
            queryId: undefined,
          });

          addToHistory({
            sql: statement,
            error: data.error?.userMessage || "Error",
          });
          return;
        }

        executedCount++;
        if (data.statistics) {
          totalElapsed += data.statistics.elapsed;
        }

        // Check if this is a SELECT (has data)
        if (data.data && data.data.length > 0) {
          lastSelectResult = data;
        }
      }

      // All statements succeeded
      const currentTab = getActiveQueryTab();
      if (!currentTab || currentTab.id !== tab.id || !currentTab.isRunning) {
        return;
      }

      if (
        lastSelectResult &&
        lastSelectResult.data &&
        lastSelectResult.meta &&
        lastSelectResult.statistics
      ) {
        // Show result of last SELECT
        updateTab(tab.id, {
          isRunning: false,
          result: {
            data: lastSelectResult.data as Record<string, unknown>[],
            meta: lastSelectResult.meta,
            rows: lastSelectResult.rows!,
            rows_before_limit_at_least:
              lastSelectResult.rows_before_limit_at_least,
            statistics: {
              ...lastSelectResult.statistics,
              elapsed: totalElapsed,
            },
          },
          error: null,
          queryId: undefined,
        });

        addToHistory({
          sql,
          duration: totalElapsed,
          rowsReturned: lastSelectResult.rows,
          rowsRead: lastSelectResult.statistics.rows_read,
          bytesRead: lastSelectResult.statistics.bytes_read,
          memoryUsage: lastSelectResult.statistics.memory_usage,
          user: user?.username,
        });
      } else {
        // No SELECT results, show success message
        updateTab(tab.id, {
          isRunning: false,
          result: {
            data: [
              {
                message: `${executedCount} statement(s) executed successfully`,
              },
            ],
            meta: [{ name: "message", type: "String" }],
            rows: 1,
            statistics: {
              elapsed: totalElapsed,
              rows_read: 0,
              bytes_read: 0,
            },
          },
          error: null,
          queryId: undefined,
        });

        addToHistory({
          sql,
          duration: totalElapsed,
          rowsReturned: 0,
          rowsRead: 0,
          bytesRead: 0,
          user: user?.username,
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
        queryId: undefined,
      });

      addToHistory({
        sql,
        error: "Network error",
      });
    }
  }, [getActiveQueryTab, updateTab, addToHistory, user]);

  const handleCancel = useCallback(async () => {
    const tab = getActiveQueryTab();
    if (!tab || !tab.isRunning || !tab.queryId) return;

    try {
      await fetch("/api/clickhouse/kill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryId: tab.queryId }),
      });

      updateTab(tab.id, {
        isRunning: false,
        queryId: undefined,
        error: {
          code: 0,
          message: "Query cancelled by user",
          type: "CANCELLED",
          userMessage: "Query cancelled by user",
        },
      });
    } catch (e) {
      console.error("Failed to cancel query", e);
    }
  }, [getActiveQueryTab, updateTab]);

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
            variant="outline"
            onClick={() => setSaveDialogOpen(true)}
            disabled={!activeQueryTab || !activeQueryTab.sql.trim()}
          >
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSavedQueriesOpen(true)}
            className="text-muted-foreground"
          >
            <Bookmark className="w-4 h-4 mr-1" />
            Saved
          </Button>

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

          {activeQueryTab?.isRunning && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleCancel}
              className="ml-2"
            >
              <Square className="w-4 h-4 mr-1 fill-current" />
              Stop
            </Button>
          )}

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

          <Sheet open={savedQueriesOpen} onOpenChange={setSavedQueriesOpen}>
            <SheetContent className="w-[400px] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Saved Queries</SheetTitle>
              </SheetHeader>
              <SavedQueries
                onSelect={(sql) => {
                  if (activeTabId && activeQueryTab) {
                    updateTab(activeTabId, { sql });
                    setSavedQueriesOpen(false);
                  }
                }}
              />
            </SheetContent>
          </Sheet>

          <SaveQueryDialog
            open={saveDialogOpen}
            onOpenChange={setSaveDialogOpen}
            sql={activeQueryTab?.sql || ""}
            onSaved={() => {
              // Refresh saved queries list if needed, or rely on component re-mount/focus
              // Since SavedQueries component fetches on mount, reopening it will refresh
            }}
          />
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
