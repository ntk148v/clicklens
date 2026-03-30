"use client";

import { useEffect, useMemo, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useTabsStore, initializeTabs } from "@/lib/store/tabs";
import { useSqlBrowserStore } from "@/lib/store/sql-browser";
import { useAuth } from "@/components/auth";
import { QueryCancellationManager } from "@/lib/clickhouse/cancellation";
import { useSqlExecution } from "./use-sql-execution";
import { useSqlPagination } from "./use-sql-pagination";
import { useSqlUI } from "./use-sql-ui";
import { useSqlCursor } from "./use-sql-cursor";
import { useSqlExplain } from "./use-sql-explain";
import type { ExplainType } from "@/components/sql";

export interface SqlPageState {
  tabs: ReturnType<typeof useTabsStore.getState>["tabs"];
  activeTabId: string | null;
  activeTab: ReturnType<typeof useTabsStore.getState>["tabs"][0] | undefined;
  activeQueryTab: Extract<ReturnType<typeof useTabsStore.getState>["tabs"][0], { type: "query" }> | undefined;
  selectedDatabase: string | null;
  databases: string[];
  tables: ReturnType<typeof useSqlBrowserStore.getState>["tables"];
  getColumnsForTable: ReturnType<typeof useSqlBrowserStore.getState>["getColumnsForTable"];
  user: ReturnType<typeof useAuth>["user"];
  permissions: ReturnType<typeof useAuth>["permissions"];
  authLoading: boolean;
  csrfToken: string | null;
  historyOpen: boolean;
  savedQueriesOpen: boolean;
  saveDialogOpen: boolean;
  cursorPosition: number;
  tabPagination: Record<string, { page: number; pageSize: number }>;
  queryHistory: ReturnType<typeof useTabsStore.getState>["history"];
}

export interface SqlPageActions {
  updateTab: ReturnType<typeof useTabsStore.getState>["updateTab"];
  getActiveQueryTab: ReturnType<typeof useTabsStore.getState>["getActiveQueryTab"];
  addToHistory: ReturnType<typeof useTabsStore.getState>["addToHistory"];
  setHistoryOpen: (open: boolean) => void;
  setSavedQueriesOpen: (open: boolean) => void;
  setSaveDialogOpen: (open: boolean) => void;
  setCursorPosition: (position: number) => void;
  handleExecute: (page?: number, pageSize?: number) => Promise<void>;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (size: number) => void;
  handleCancel: () => Promise<void>;
  handleSqlChange: (value: string) => void;
  handleCursorChange: (position: number) => void;
  handleExecuteAtCursor: () => Promise<void>;
  handleExplain: (type: ExplainType) => Promise<void>;
  handleApplyTimeRange: (start: Date, end: Date, columnName: string) => void;
  handleHistorySelect: (sql: string) => void;
  clearHistory: () => void;
}

export function useSqlPage(): SqlPageState & SqlPageActions {
  // External dependencies
  const cancellationManager = useMemo(() => new QueryCancellationManager(), []);
  const { tabs, activeTabId, updateTab, getActiveQueryTab, addToHistory, clearHistory } = useTabsStore();
  const { selectedDatabase, databases, tables, getColumnsForTable } = useSqlBrowserStore();
  const { user, permissions, isLoading: authLoading, csrfToken } = useAuth();
  const router = useRouter();

  // Initialize tabs on mount
  useEffect(() => {
    initializeTabs();
  }, []);

  // Redirect if no execute permission
  useEffect(() => {
    if (!authLoading && !permissions?.canExecuteQueries) {
      router.push("/");
    }
  }, [authLoading, permissions, router]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeQueryTab = activeTab?.type === "query" ? activeTab : undefined;

  // Compose focused hooks
  const { execute, isExecuting } = useSqlExecution({
    cancellationManager,
    csrfToken,
    selectedDatabase,
    user,
    updateTab,
    getActiveQueryTab,
    addToHistory,
  });

  // Wrapper to match original interface (no sql parameter)
  const handleExecute = useCallback(
    async (page: number = 0, pageSize: number = 100) => {
      const tab = getActiveQueryTab();
      if (!tab) return;
      await execute(tab.sql, page, pageSize);
    },
    [execute, getActiveQueryTab]
  );

  const { pagination, handlePageChange: paginationPageChange, handlePageSizeChange: paginationPageSizeChange } = useSqlPagination({
    activeTabId,
    onPageChange: async (page, size) => {
      const tab = getActiveQueryTab();
      if (tab) {
        await execute(tab.sql, page, size);
      }
    },
  });

  // Wrappers to match original interface (void return)
  const handlePageChange = useCallback(
    (page: number) => {
      paginationPageChange(page);
    },
    [paginationPageChange]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      paginationPageSizeChange(size);
    },
    [paginationPageSizeChange]
  );

  const { historyOpen, savedQueriesOpen, saveDialogOpen, setHistoryOpen, setSavedQueriesOpen, setSaveDialogOpen } = useSqlUI();

  const { cursorPosition, handleCursorChange, executeAtCursor } = useSqlCursor({
    cancellationManager,
    csrfToken,
    selectedDatabase,
    user,
    updateTab,
    getActiveQueryTab,
    addToHistory,
  });

  const { explain, isExplaining } = useSqlExplain({
    csrfToken,
    selectedDatabase,
    updateTab,
    getActiveQueryTab,
  });

  // Orchestrator-only handlers
  const handleCancel = useCallback(async () => {
    const tab = getActiveQueryTab();
    if (!tab || !tab.isRunning || !tab.queryId) return;

    cancellationManager.cancel(tab.queryId);

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
  }, [getActiveQueryTab, updateTab, cancellationManager]);

  const handleSqlChange = useCallback(
    (value: string) => {
      if (activeTabId && activeQueryTab) {
        updateTab(activeTabId, { sql: value });
      }
    },
    [activeTabId, activeQueryTab, updateTab]
  );

  const handleApplyTimeRange = useCallback(
    (start: Date, end: Date, columnName: string) => {
      const tab = getActiveQueryTab();
      if (!tab || tab.isRunning) return;

      const formatSqlDate = (d: Date) => {
        const pad = (n: number) => n.toString().padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
          d.getDate()
        )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const startStr = formatSqlDate(start);
      const endStr = formatSqlDate(end);

      const safeColumn = columnName.trim() || "event_time";
      const timeClause = `${safeColumn} BETWEEN toDateTime('${startStr}', '${timezone}') AND toDateTime('${endStr}', '${timezone}')`;

      const currentSql = tab.sql;

      const trailingSemiRegex = /;\s*$/;
      const hasTrailingSemi = trailingSemiRegex.test(currentSql);
      const sqlBody = currentSql.replace(trailingSemiRegex, "");

      const clausesRegex =
        /\b(GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|OFFSET|SETTINGS|FORMAT|WINDOW)\b/i;
      const match = clausesRegex.exec(sqlBody);

      let insertIndex = sqlBody.length;
      if (match) {
        insertIndex = match.index;
      }

      const textBefore = sqlBody.slice(0, insertIndex);
      const hasWhere = /\bWHERE\b/i.test(textBefore);

      const prefix = hasWhere ? " AND " : " WHERE ";

      const preppedPrefix =
        (textBefore.endsWith(" ") ? "" : " ") + prefix.trim() + " ";

      const newSql =
        textBefore +
        preppedPrefix +
        timeClause +
        " " +
        sqlBody.slice(insertIndex) +
        (hasTrailingSemi ? ";" : "");

      updateTab(tab.id, { sql: newSql });

      toast({
        title: "Time range inserted",
        description: `Using column '${safeColumn}'. Applied correctly to query structure.`,
      });
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
    [activeTabId, activeQueryTab, updateTab, setHistoryOpen]
  );

  // Get history from useTabsStore
  const { history: queryHistory } = useTabsStore();

  return {
    // State from stores
    tabs,
    activeTabId,
    activeTab,
    activeQueryTab,
    selectedDatabase,
    databases,
    tables,
    getColumnsForTable,
    user,
    permissions,
    authLoading,
    csrfToken,
    // State from hooks
    historyOpen,
    savedQueriesOpen,
    saveDialogOpen,
    cursorPosition,
    tabPagination: pagination,
    queryHistory,

    // Actions from stores
    updateTab,
    getActiveQueryTab,
    addToHistory,
    clearHistory,
    // Actions from hooks
    setHistoryOpen,
    setSavedQueriesOpen,
    setSaveDialogOpen,
    setCursorPosition: handleCursorChange,
    handleExecute,
    handlePageChange,
    handlePageSizeChange,
    handleCancel,
    handleSqlChange,
    handleCursorChange,
    handleExecuteAtCursor: executeAtCursor,
    handleExplain: explain,
    handleApplyTimeRange,
    handleHistorySelect,
  };
}
