"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
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
  ExplainButton,
  ExplainVisualizer,
  type ExplainType,
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
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// import type { QueryResponse } from "@/app/api/clickhouse/query/route"; // Removed

interface QueryResult {
  data: any[]; // Can be Record<string, unknown>[] or any[][]
  meta: Array<{ name: string; type: string }>;
  rows: number;
  rows_before_limit_at_least?: number;
  statistics: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
    memory_usage?: number;
  };
}

export default function SqlConsolePage() {
  const { tabs, activeTabId, updateTab, getActiveQueryTab, addToHistory } =
    useTabsStore();
  const { user, permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedQueriesOpen, setSavedQueriesOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Permission guard
  useEffect(() => {
    if (!authLoading && !permissions?.canExecuteQueries) {
      router.push("/");
    }
  }, [authLoading, permissions, router]);

  // Local state for pagination per tab
  // map of tabId -> { page: number, pageSize: number }
  const [tabPagination, setTabPagination] = useState<
    Record<string, { page: number; pageSize: number }>
  >({});

  // Initialize tabs on first load
  useEffect(() => {
    initializeTabs();
  }, []);

  // Show loading while checking permissions
  if (authLoading || !permissions?.canExecuteQueries) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeQueryTab = activeTab?.type === "query" ? activeTab : null;

  const handleExecute = useCallback(
    async (page: number = 0, pageSize: number = 100) => {
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

      // Update active page
      setTabPagination((prev) => ({
        ...prev,
        [tab.id]: { page, pageSize },
      }));

      let lastSelectResult: QueryResult | null = null;
      let executedCount = 0;
      let totalElapsed = 0;

      try {
        for (const statement of statements) {
          // Check if cancelled
          const currentTab = getActiveQueryTab();
          if (
            !currentTab ||
            currentTab.id !== tab.id ||
            !currentTab.isRunning
          ) {
            return;
          }

          const response = await fetch("/api/clickhouse/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sql: statement,
              query_id: queryId,
              page: page,
              pageSize: pageSize,
            }),
          });

          if (!response.ok || !response.body) {
            throw new Error("Failed to start query execution");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          // Initialize incremental result for this statement
          let currentMeta: Array<{ name: string; type: string }> = [];
          let currentData: Record<string, unknown>[] = [];
          let currentStatistics = {
            elapsed: 0,
            rows_read: 0,
            bytes_read: 0,
          };
          let limitReached = false;
          let queryError = null;
          let isSelect = false;
          let lastUpdate = 0;

          let buffer = "";
          // Process stream
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim()) continue;

              try {
                const event = JSON.parse(line);

                if (event.type === "meta") {
                  currentMeta = event.data;
                  isSelect = true; // If we get meta, it's a SELECT-like query
                  // Update tab immediately to show headers?
                  // Optionally we can update UI here to show empty table with headers
                } else if (event.type === "data") {
                  // event.data is an array of rows [ [val1, val2], ... ]
                  // Optimization: Store raw arrays to save memory. ResultGrid now supports this via accessorFn.

                  // details: event.data is array of arrays (rows).
                  // Just push them directly.
                  currentData.push(...event.data);

                  // Throttle UI updates to avoid freezing
                  const now = Date.now();
                  if (now - lastUpdate > 200) {
                    updateTab(tab.id, {
                      isRunning: true,
                      result: {
                        data: [...currentData], // Create copy for React state only on render
                        meta: currentMeta,
                        rows: currentData.length,
                        statistics: {
                          ...currentStatistics,
                          rows_read: event.rows_count,
                        },
                      },
                    });
                    lastUpdate = now;
                  }
                } else if (event.type === "progress") {
                  // Update statistics
                  currentStatistics.rows_read = event.rows_read;
                  updateTab(tab.id, {
                    result: {
                      data: currentData, // Keep existing
                      meta: currentMeta,
                      rows: currentData.length,
                      statistics: currentStatistics,
                    } as any, // partial update workaround
                  });
                } else if (event.type === "done") {
                  limitReached = event.limit_reached;
                  if (event.statistics) {
                    currentStatistics = {
                      ...currentStatistics,
                      ...event.statistics,
                    };
                  }
                } else if (event.type === "error") {
                  queryError = event.error;
                }
              } catch (e) {
                console.error("Error parsing chunk", e);
              }
            }
          }

          if (queryError) {
            throw new Error(queryError.message || "Query failed");
          }

          executedCount++;
          totalElapsed += currentStatistics.elapsed;

          if (isSelect) {
            lastSelectResult = {
              data: currentData,
              meta: currentMeta,
              rows: currentData.length,
              statistics: currentStatistics,
              rows_before_limit_at_least: limitReached ? 500000 : undefined, // Just a hint
            };
          }
        }

        // All statements succeeded
        const currentTab = getActiveQueryTab();
        if (!currentTab || currentTab.id !== tab.id || !currentTab.isRunning) {
          return;
        }

        if (lastSelectResult) {
          // Final update
          updateTab(tab.id, {
            isRunning: false,
            result: lastSelectResult,
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
    },
    [getActiveQueryTab, updateTab, addToHistory, user]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      // ResultGrid passes 1-based page index, but our API uses 0-based
      const currentSize = tabPagination[activeTabId || ""]?.pageSize || 100;
      handleExecute(page - 1, currentSize);
    },
    [handleExecute, tabPagination, activeTabId]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      // Reset to page 0 when size changes
      handleExecute(0, size);
    },
    [handleExecute]
  );

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

  const handleCursorChange = useCallback((position: number) => {
    setCursorPosition(position);
  }, []);

  const handleExecuteAtCursor = useCallback(async () => {
    const tab = getActiveQueryTab();
    if (!tab || tab.isRunning) return;

    const sql = tab.sql.trim();
    if (!sql) return;

    const { findStatementAtPosition } = await import("@/lib/sql");
    const statement = findStatementAtPosition(tab.sql, cursorPosition);

    if (!statement) return;

    const queryId = crypto.randomUUID();
    updateTab(tab.id, { isRunning: true, error: null, queryId });

    try {
      const response = await fetch("/api/clickhouse/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: statement, query_id: queryId }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to start query execution");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let currentMeta: Array<{ name: string; type: string }> = [];
      let currentData: Record<string, unknown>[] = [];
      let currentStatistics = {
        elapsed: 0,
        rows_read: 0,
        bytes_read: 0,
      };
      let limitReached = false;
      let queryError = null;
      let lastUpdate = 0;

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last part in buffer as it might be incomplete
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === "meta") {
              currentMeta = event.data;
            } else if (event.type === "data") {
              currentData.push(...event.data);

              // Throttle UI updates
              const now = Date.now();
              if (now - lastUpdate > 200) {
                updateTab(tab.id, {
                  isRunning: true,
                  result: {
                    data: [...currentData],
                    meta: currentMeta,
                    rows: currentData.length,
                    statistics: {
                      ...currentStatistics,
                      rows_read: event.rows_count,
                    },
                  },
                });
                lastUpdate = now;
              }
            } else if (event.type === "done") {
              limitReached = event.limit_reached;
              if (event.statistics) {
                currentStatistics = {
                  ...currentStatistics,
                  ...event.statistics,
                };
              }
            } else if (event.type === "error") {
              queryError = event.error;
            }
          } catch (e) {
            console.error("Error parsing chunk", e, line);
          }
        }
      }

      if (queryError) {
        throw new Error(queryError.message || "Query failed");
      }

      const currentTab = getActiveQueryTab();
      if (!currentTab || currentTab.id !== tab.id || !currentTab.isRunning)
        return;

      updateTab(tab.id, {
        isRunning: false,
        result: {
          data: currentData,
          meta: currentMeta,
          rows: currentData.length,
          rows_before_limit_at_least: limitReached ? 500000 : undefined,
          statistics: currentStatistics,
        },
        error: null,
        queryId: undefined,
      });

      addToHistory({
        sql: statement,
        duration: currentStatistics.elapsed,
        rowsReturned: currentData.length,
        rowsRead: currentStatistics.rows_read,
        bytesRead: currentStatistics.bytes_read,
        memoryUsage: 0,
        user: user?.username,
      });
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
        sql: statement,
        error: "Network error",
      });
    }
  }, [getActiveQueryTab, updateTab, addToHistory, user, cursorPosition]);

  const handleExplain = useCallback(
    async (type: ExplainType) => {
      const tab = getActiveQueryTab();
      if (!tab || tab.isRunning) return;

      const sql = tab.sql.trim();
      if (!sql) return;

      const { splitSqlStatements } = await import("@/lib/sql");
      const statements = splitSqlStatements(sql);
      // Only explain the first statement if multiple
      const statement = statements[0];

      if (!statement) return;

      // Reset previous results
      updateTab(tab.id, {
        isRunning: true,
        error: null,
        result: null,
        explainResult: null,
      });

      try {
        let query = "";
        let format = undefined;

        // Remove existing EXPLAIN prefix if present to avoid double explain
        // Regex handles "EXPLAIN", "EXPLAIN AST", "EXPLAIN PLAN", etc.
        const cleanStatement = statement.replace(/^EXPLAIN\s+(\w+\s+)?/i, "");
        query = `EXPLAIN ${type} ${cleanStatement}`;

        const response = await fetch("/api/clickhouse/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sql: query,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "Failed to explain");
        }

        // Read the stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let resultData = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            resultData += decoder.decode(value, { stream: true });
          }
        }

        // Process result
        // If we used format="JSON", resultData should be the JSON string.
        // If we used default format, resultData is NDJSON stream of rows.

        let finalData: string | object = resultData;

        // NDJSON row parsing
        // We expect 1 row with 1 column usually
        const lines = resultData.split("\n");
        let capturedText = "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "data") {
              // event.data is [[ "text" ]]
              if (Array.isArray(event.data)) {
                for (const row of event.data) {
                  // row is array of columns.
                  // explain usually has 1 column 'explain'
                  const colVal =
                    row[Object.keys(row)[0]] || Object.values(row)[0];
                  capturedText += colVal + "\n";
                }
              }
            } else if (event.type === "error") {
              throw new Error(event.error.message);
            }
          } catch (e) {
            // ignore
          }
        }
        finalData = capturedText || resultData;

        updateTab(tab.id, {
          isRunning: false,
          explainResult: { type, data: finalData },
        });
      } catch (error) {
        updateTab(tab.id, {
          isRunning: false,
          error: {
            code: 0,
            message: error instanceof Error ? error.message : "Unknown error",
            type: "EXPLAIN_ERROR",
            userMessage: "Failed to explain query",
          },
        });
      }
    },
    [getActiveQueryTab, updateTab]
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

          <ExplainButton
            onExplain={handleExplain}
            disabled={!activeQueryTab || activeQueryTab.isRunning}
          />

          <Separator orientation="vertical" className="h-6 mx-2" />

          <div className="flex items-center">
            <Button
              size="sm"
              onClick={() =>
                handleExecute(
                  0,
                  tabPagination[activeTabId || ""]?.pageSize || 100
                )
              } // Maintain current page size
              disabled={!activeQueryTab || activeQueryTab.isRunning}
              className="rounded-r-none"
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  disabled={!activeQueryTab || activeQueryTab.isRunning}
                  className="rounded-l-none border-l-0 px-2"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    handleExecute(
                      0,
                      tabPagination[activeTabId || ""]?.pageSize || 100
                    )
                  }
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run All
                  <span className="ml-auto text-xs text-muted-foreground">
                    Ctrl+Enter
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExecuteAtCursor}>
                  <Play className="w-4 h-4 mr-2" />
                  Run at Cursor
                  <span className="ml-auto text-xs text-muted-foreground">
                    Shift+Enter
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

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
                    onExecuteAtCursor={handleExecuteAtCursor}
                    onCursorChange={handleCursorChange}
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
                        // If we hit limit or it's pagination mode, we might not know total rows
                        // But we want to enable "Next" button if we have full page.
                        // We can pass undefined or estimate
                        undefined
                      }
                      page={tabPagination[activeTabId || ""]?.page || 0}
                      pageSize={
                        tabPagination[activeTabId || ""]?.pageSize || 100
                      }
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                      className="h-full"
                    />
                  ) : activeQueryTab.explainResult ? (
                    <ExplainVisualizer
                      type={activeQueryTab.explainResult.type}
                      data={activeQueryTab.explainResult.data}
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
