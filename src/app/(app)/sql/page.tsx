"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Header } from "@/components/layout";
import {
  VirtualizedResultGrid,
  QueryTabs,
  QueryHistory,
  DatabaseSelector,
  TableSidebar,
  TablePreview,
  SavedQueries,
  SaveQueryDialog,
  ExplainButton,
  ExplainVisualizer,
  TimeRangeSelector,
  SqlResultSkeleton,
  type ExplainType,
} from "@/components/sql";

const SqlEditor = dynamic(
  () => import("@/components/sql/SqlEditor").then((mod) => mod.SqlEditor),
  {
    loading: () => (
      <div className="h-full w-full rounded-md border border-border p-4 flex items-center justify-center text-muted-foreground text-sm">
        Loading editor...
      </div>
    ),
    ssr: false,
  },
);
import { useSqlPage } from "@/lib/hooks/use-sql-page";
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
  QueryLoadingState,
  StreamingProgressIndicator,
} from "@/components/ui/loading";
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

export default function SqlConsolePage() {
  const {
    activeTabId,
    activeQueryTab,
    selectedDatabase,
    databases,
    tables,
    getColumnsForTable,
    permissions,
    authLoading,
    historyOpen,
    savedQueriesOpen,
    saveDialogOpen,
    tabPagination,
    updateTab,
    setHistoryOpen,
    setSavedQueriesOpen,
    setSaveDialogOpen,
    handleExecute,
    handlePageChange,
    handlePageSizeChange,
    handleCancel,
    handleSqlChange,
    handleCursorChange,
    handleExecuteAtCursor,
    handleExplain,
    handleApplyTimeRange,
    handleHistorySelect,
  } = useSqlPage();

  const router = useRouter();
  const activeTab = useSqlPage().activeTab;

  const streamedRows = activeQueryTab?.result?.data?.length ?? 0;
  const isStreaming = Boolean(activeQueryTab?.isRunning) && streamedRows > 0;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!permissions?.canExecuteQueries) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <AlertCircle className="h-16 w-16 opacity-50" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm mt-2 max-w-md">
            You don&apos;t have permission to access the SQL Console. Your
            ClickHouse user account doesn&apos;t have SELECT access to any
            databases.
          </p>
          <p className="text-xs mt-4 text-muted-foreground/70">
            Contact your administrator to request database access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="SQL Console">
        <div className="flex flex-wrap items-center gap-2">
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

          <Separator orientation="vertical" className="h-6 hidden sm:inline" />

          <ExplainButton
            onExplain={handleExplain}
            disabled={!activeQueryTab || activeQueryTab.isRunning}
          />

          <Separator orientation="vertical" className="h-6 mx-2 hidden sm:inline" />

          <TimeRangeSelector
            onApply={handleApplyTimeRange}
            disabled={!activeQueryTab || activeQueryTab.isRunning}
          />

          <Separator orientation="vertical" className="h-6 mx-2 hidden sm:inline" />

          <div className="flex items-center">
            <Button
              size="sm"
              onClick={() =>
                handleExecute(
                  0,
                  tabPagination[activeTabId || ""]?.pageSize || 100,
                )
              }
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
                      tabPagination[activeTabId || ""]?.pageSize || 100,
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
            onSaved={() => {}}
          />
        </div>
      </Header>

      <div className="flex-1 flex min-h-0">
        <TableSidebar />

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <QueryTabs />

          <div className="flex-1 flex flex-col min-h-0">
            {activeTab?.type === "table" ? (
              <TablePreview
                database={activeTab.database}
                table={activeTab.table}
              />
            ) : activeQueryTab ? (
              <>
                <div className="h-[150px] md:h-[200px] p-3 md:p-4 border-b">
                  <SqlEditor
                    value={activeQueryTab.sql}
                    onChange={handleSqlChange}
                    onExecute={handleExecute}
                    onExecuteAtCursor={handleExecuteAtCursor}
                    onCursorChange={handleCursorChange}
                    readOnly={activeQueryTab.isRunning}
                    databases={databases}
                    tables={tables}
                    selectedDatabase={selectedDatabase}
                    getColumns={getColumnsForTable}
                  />
                </div>

                <div className="flex-1 min-h-0">
                  {activeQueryTab.isRunning && !activeQueryTab.result ? (
                    <QueryLoadingState
                      isRunning={true}
                      className="h-full flex items-center justify-center"
                    />
                  ) : activeQueryTab.result ? (
                    <div className="relative h-full">
                      <VirtualizedResultGrid
                        data={activeQueryTab.result.data}
                        meta={activeQueryTab.result.meta}
                        statistics={activeQueryTab.result.statistics}
                        totalRows={undefined}
                        page={tabPagination[activeTabId || ""]?.page || 0}
                        pageSize={
                          tabPagination[activeTabId || ""]?.pageSize || 100
                        }
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                        className="h-full"
                        isLoading={activeQueryTab.isRunning}
                      />
                      <StreamingProgressIndicator
                        isStreaming={isStreaming}
                        rowCount={streamedRows}
                        totalHits={-1}
                        className="absolute bottom-4 left-4 right-4 z-10"
                      />
                    </div>
                  ) : activeQueryTab.explainResult ? (
                    <ExplainVisualizer
                      type={activeQueryTab.explainResult.type}
                      data={activeQueryTab.explainResult.data}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-8 overflow-auto">
                      <div className="max-w-2xl w-full space-y-6">
                        <div className="text-center space-y-2">
                          <h2 className="text-xl font-semibold">
                            Welcome to SQL Console
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            Write and execute ClickHouse SQL queries
                          </p>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                          <h3 className="text-sm font-medium">
                            Keyboard Shortcuts
                          </h3>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                Run all queries
                              </span>
                              <div className="flex gap-1">
                                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">
                                  Ctrl
                                </kbd>
                                <span>+</span>
                                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">
                                  Enter
                                </kbd>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                Run at cursor
                              </span>
                              <div className="flex gap-1">
                                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">
                                  Shift
                                </kbd>
                                <span>+</span>
                                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">
                                  Enter
                                </kbd>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                Autocomplete
                              </span>
                              <div className="flex gap-1">
                                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">
                                  Ctrl
                                </kbd>
                                <span>+</span>
                                <kbd className="px-1.5 py-0.5 rounded bg-background border font-mono">
                                  Space
                                </kbd>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-sm font-medium">
                            ClickHouse Documentation
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <a
                              href="https://clickhouse.com/docs/en/sql-reference"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                            >
                              <FileText className="w-6 h-6 mb-2 text-muted-foreground group-hover:text-foreground" />
                              <span className="text-sm font-medium">
                                SQL Reference
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Syntax & statements
                              </span>
                            </a>
                            <a
                              href="https://clickhouse.com/docs/en/sql-reference/functions"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                            >
                              <Play className="w-6 h-6 mb-2 text-muted-foreground group-hover:text-foreground" />
                              <span className="text-sm font-medium">
                                Functions
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Built-in functions
                              </span>
                            </a>
                            <a
                              href="https://clickhouse.com/docs/en/sql-reference/data-types"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors group"
                            >
                              <AlertCircle className="w-6 h-6 mb-2 text-muted-foreground group-hover:text-foreground" />
                              <span className="text-sm font-medium">
                                Data Types
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Type reference
                              </span>
                            </a>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-sm font-medium">
                            Quick Examples
                          </h3>
                          <div className="space-y-2 text-xs font-mono bg-muted/50 rounded-lg p-4">
                            <p className="text-muted-foreground">
                              -- Show all databases
                            </p>
                            <p>SHOW DATABASES;</p>
                            <p className="text-muted-foreground mt-2">
                              -- Show tables in current database
                            </p>
                            <p>SHOW TABLES;</p>
                            <p className="text-muted-foreground mt-2">
                              -- Query system metrics
                            </p>
                            <p>SELECT * FROM system.metrics LIMIT 10;</p>
                          </div>
                        </div>
                      </div>
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
