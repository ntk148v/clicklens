"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useTabsStore, initializeTabs } from "@/lib/store/tabs";
import { useSqlBrowserStore } from "@/lib/store/sql-browser";
import { useAuth } from "@/components/auth";
import { generateUUID } from "@/lib/utils";
import { useSqlQueryStore } from "@/stores/sql/query-store";
import { createSqlDataStore } from "@/stores/sql/data-store";
import { useSqlUIStore } from "@/stores/sql/ui-store";
import type { ExplainType } from "@/components/sql";

interface ApiError {
  code: number;
  type: string;
  category?: string;
  message: string;
  userMessage: string;
  hint?: string;
}

interface QueryResult {
  data: unknown[];
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

const getErrorInfo = (error: unknown): ApiError => {
  if (
    error &&
    typeof error === "object" &&
    "userMessage" in error &&
    "message" in error
  ) {
    return error as ApiError;
  }

  if (error instanceof TypeError) {
    return {
      code: 0,
      message: error.message,
      type: "NETWORK_ERROR",
      category: "NETWORK",
      userMessage: "Network error",
      hint: "Unable to connect to the server. Please check your connection.",
    };
  }

  if (error instanceof Error) {
    const message = error.message;

    if (
      message.includes("Failed to fetch") ||
      message.includes("NetworkError")
    ) {
      return {
        code: 0,
        message: message,
        type: "NETWORK_ERROR",
        category: "NETWORK",
        userMessage: "Network error",
        hint: "Unable to connect to the server. Please check your connection.",
      };
    }

    if (message.includes("aborted") || message.includes("AbortError")) {
      return {
        code: 0,
        message: message,
        type: "ABORTED",
        category: "NETWORK",
        userMessage: "Request was aborted",
      };
    }

    return {
      code: 0,
      message: message,
      type: "UNKNOWN_ERROR",
      category: "UNKNOWN",
      userMessage: "Query execution failed",
      hint: message,
    };
  }

  return {
    code: 0,
    message: String(error),
    type: "UNKNOWN_ERROR",
    category: "UNKNOWN",
    userMessage: "An unexpected error occurred",
  };
};

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
  queryHistory: ReturnType<typeof useSqlQueryStore.getState>["queryHistory"];
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

const dataStore = createSqlDataStore();

export function useSqlPage(): SqlPageState & SqlPageActions {
  const { tabs, activeTabId, updateTab, getActiveQueryTab, addToHistory, clearHistory } =
    useTabsStore();
  const { selectedDatabase, databases, tables, getColumnsForTable } =
    useSqlBrowserStore();
  const { user, permissions, isLoading: authLoading, csrfToken } = useAuth();
  const router = useRouter();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedQueriesOpen, setSavedQueriesOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const [tabPagination, setTabPagination] = useState<
    Record<string, { page: number; pageSize: number }>
  >({});

  const queryStore = useSqlQueryStore();
  const uiStore = useSqlUIStore();

  useEffect(() => {
    initializeTabs();
  }, []);

  useEffect(() => {
    if (!authLoading && !permissions?.canExecuteQueries) {
      router.push("/");
    }
  }, [authLoading, permissions, router]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeQueryTab = activeTab?.type === "query" ? activeTab : undefined;

  const handleExecute = useCallback(
    async (page: number = 0, pageSize: number = 100) => {
      const tab = getActiveQueryTab();
      if (!tab || tab.isRunning) return;

      const sql = tab.sql.trim();
      if (!sql) return;

      const { splitSqlStatements } = await import("@/lib/sql");
      const statements = splitSqlStatements(sql);

      if (statements.length === 0) return;

      const queryId = generateUUID();
      updateTab(tab.id, { isRunning: true, error: null, queryId });

      setTabPagination((prev) => ({
        ...prev,
        [tab.id]: { page, pageSize },
      }));

      let lastSelectResult: QueryResult | null = null;
      let executedCount = 0;
      let totalElapsed = 0;

      try {
        for (const statement of statements) {
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
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": csrfToken || "",
            },
            body: JSON.stringify({
              sql: statement,
              query_id: queryId,
              page: page,
              pageSize: pageSize,
              database: selectedDatabase,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }),
          });

          if (!response.ok) {
            let errorDetails: ApiError = {
              code: response.status,
              message: response.statusText || `HTTP ${response.status} error`,
              type: "HTTP_ERROR",
              userMessage: `Request failed with status ${response.status}`,
            };
            try {
              const errorData = await response.json();
              if (errorData.error) {
                errorDetails = errorData.error;
              }
            } catch {
              // Use default errorDetails
            }

            throw errorDetails;
          }

          if (!response.body) {
            throw {
              code: 0,
              message: "Response body is empty",
              type: "EMPTY_RESPONSE",
              userMessage: "Server returned an empty response",
            } as ApiError;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          let currentMeta: Array<{ name: string; type: string }> = [];
          const currentData: Record<string, unknown>[] = [];
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
                  isSelect = true;
                } else if (event.type === "data") {
                  currentData.push(...event.data);

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
                } else if (event.type === "progress") {
                  currentStatistics.rows_read = event.rows_read;
                  updateTab(tab.id, {
                    result: {
                      data: currentData,
                      meta: currentMeta,
                      rows: currentData.length,
                      statistics: currentStatistics,
                    } as unknown as QueryResult,
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
            throw queryError;
          }

          executedCount++;
          totalElapsed += currentStatistics.elapsed;

          if (isSelect) {
            lastSelectResult = {
              data: currentData,
              meta: currentMeta,
              rows: currentData.length,
              statistics: currentStatistics,
              rows_before_limit_at_least: limitReached ? 500000 : undefined,
            };
          }
        }

        const currentTab = getActiveQueryTab();
        if (!currentTab || currentTab.id !== tab.id || !currentTab.isRunning) {
          return;
        }

        if (lastSelectResult) {
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

          queryStore.addToHistory({
            sql,
            duration: totalElapsed,
            rowsReturned: lastSelectResult.rows,
            rowsRead: lastSelectResult.statistics.rows_read,
            bytesRead: lastSelectResult.statistics.bytes_read,
            memoryUsage: lastSelectResult.statistics.memory_usage,
            user: user?.username,
          });
        } else {
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

          queryStore.addToHistory({
            sql,
            duration: totalElapsed,
            rowsReturned: 0,
            rowsRead: 0,
            bytesRead: 0,
            user: user?.username,
          });
        }
      } catch (error) {
        const errorInfo = getErrorInfo(error);
        updateTab(tab.id, {
          isRunning: false,
          result: null,
          error: errorInfo,
          queryId: undefined,
        });

        toast({
          variant: "destructive",
          title: errorInfo.userMessage,
          description: errorInfo.hint || errorInfo.message,
        });

        addToHistory({
          sql,
          error: errorInfo.userMessage,
        });

        queryStore.addToHistory({
          sql,
          error: errorInfo.userMessage,
        });
      }
    },
    [getActiveQueryTab, updateTab, addToHistory, user, selectedDatabase, csrfToken, queryStore],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      const currentSize = tabPagination[activeTabId || ""]?.pageSize || 100;
      handleExecute(page - 1, currentSize);
    },
    [handleExecute, tabPagination, activeTabId],
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      handleExecute(0, size);
    },
    [handleExecute],
  );

  const handleCancel = useCallback(async () => {
    const tab = getActiveQueryTab();
    if (!tab || !tab.isRunning || !tab.queryId) return;

    try {
      await fetch("/api/clickhouse/kill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken || "",
        },
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
  }, [getActiveQueryTab, updateTab, csrfToken]);

  const handleSqlChange = useCallback(
    (value: string) => {
      if (activeTabId && activeQueryTab) {
        updateTab(activeTabId, { sql: value });
        queryStore.setQuery(value);
      }
    },
    [activeTabId, activeQueryTab, updateTab, queryStore],
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

    const queryId = generateUUID();
    updateTab(tab.id, { isRunning: true, error: null, queryId });

    try {
      const response = await fetch("/api/clickhouse/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken || "",
        },
        body: JSON.stringify({
          sql: statement,
          query_id: queryId,
          database: selectedDatabase,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!response.ok) {
        let errorDetails: ApiError = {
          code: response.status,
          message: response.statusText || `HTTP ${response.status} error`,
          type: "HTTP_ERROR",
          userMessage: `Request failed with status ${response.status}`,
        };
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorDetails = errorData.error;
          }
        } catch {
          // Use default errorDetails
        }

        throw errorDetails;
      }

      if (!response.body) {
        throw {
          code: 0,
          message: "Response body is empty",
          type: "EMPTY_RESPONSE",
          userMessage: "Server returned an empty response",
        } as ApiError;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let currentMeta: Array<{ name: string; type: string }> = [];
      const currentData: Record<string, unknown>[] = [];
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
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === "meta") {
              currentMeta = event.data;
            } else if (event.type === "data") {
              currentData.push(...event.data);

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
        throw queryError;
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

      queryStore.addToHistory({
        sql: statement,
        duration: currentStatistics.elapsed,
        rowsReturned: currentData.length,
        rowsRead: currentStatistics.rows_read,
        bytesRead: currentStatistics.bytes_read,
        memoryUsage: 0,
        user: user?.username,
      });
    } catch (error) {
      const errorInfo = getErrorInfo(error);
      updateTab(tab.id, {
        isRunning: false,
        result: null,
        error: errorInfo,
        queryId: undefined,
      });

      toast({
        variant: "destructive",
        title: errorInfo.userMessage,
        description: errorInfo.hint || errorInfo.message,
      });

      addToHistory({
        sql: statement,
        error: errorInfo.userMessage,
      });

      queryStore.addToHistory({
        sql: statement,
        error: errorInfo.userMessage,
      });
    }
  }, [
    getActiveQueryTab,
    updateTab,
    addToHistory,
    user,
    cursorPosition,
    selectedDatabase,
    csrfToken,
    queryStore,
  ]);

  const handleExplain = useCallback(
    async (type: ExplainType) => {
      const tab = getActiveQueryTab();
      if (!tab || tab.isRunning) return;

      const sql = tab.sql.trim();
      if (!sql) return;

      const { splitSqlStatements } = await import("@/lib/sql");
      const statements = splitSqlStatements(sql);
      const statement = statements[0];

      if (!statement) return;

      updateTab(tab.id, {
        isRunning: true,
        error: null,
        result: null,
        explainResult: null,
      });

      try {
        let query = "";

        const cleanStatement = statement.replace(/^EXPLAIN\s+(\w+\s+)?/i, "");
        query = `EXPLAIN ${type} ${cleanStatement}`;

        const response = await fetch("/api/clickhouse/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken || "",
          },
          body: JSON.stringify({
            sql: query,
            database: selectedDatabase,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });

        if (!response.ok) {
          let errorDetails: ApiError = {
            code: response.status,
            message: response.statusText || `HTTP ${response.status} error`,
            type: "HTTP_ERROR",
            userMessage: `Request failed with status ${response.status}`,
          };
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorDetails = errorData.error;
            }
          } catch {
            // Use default errorDetails
          }
          throw errorDetails;
        }

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

        let finalData: string | object = resultData;

        const lines = resultData.split("\n");
        let capturedText = "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "data") {
              if (Array.isArray(event.data)) {
                for (const row of event.data) {
                  const colVal =
                    row[Object.keys(row)[0]] || Object.values(row)[0];
                  capturedText += colVal + "\n";
                }
              }
            } else if (event.type === "error") {
              throw new Error(event.error.message);
            }
          } catch {
            // ignore
          }
        }
        finalData = capturedText || resultData;

        updateTab(tab.id, {
          isRunning: false,
          explainResult: { type, data: finalData },
        });
      } catch (error) {
        const errorInfo = getErrorInfo(error);
        const userMessage =
          errorInfo.userMessage === "Query execution failed"
            ? "Failed to explain query"
            : errorInfo.userMessage;
        updateTab(tab.id, {
          isRunning: false,
          error: {
            code: errorInfo.code,
            message: errorInfo.message,
            type: "EXPLAIN_ERROR",
            userMessage,
            category: errorInfo.category,
            hint: errorInfo.hint,
          },
        });

        toast({
          variant: "destructive",
          title: userMessage,
          description: errorInfo.hint || errorInfo.message,
        });
      }
    },
    [getActiveQueryTab, updateTab, selectedDatabase, csrfToken],
  );

  const handleApplyTimeRange = useCallback(
    (start: Date, end: Date, columnName: string) => {
      const tab = getActiveQueryTab();
      if (!tab || tab.isRunning) return;

      const formatSqlDate = (d: Date) => {
        const pad = (n: number) => n.toString().padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
          d.getDate(),
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
      queryStore.setQuery(newSql);

      toast({
        title: "Time range inserted",
        description: `Using column '${safeColumn}'. Applied correctly to query structure.`,
      });
    },
    [getActiveQueryTab, updateTab, queryStore],
  );

  const handleHistorySelect = useCallback(
    (sql: string) => {
      if (activeTabId && activeQueryTab) {
        updateTab(activeTabId, { sql });
        queryStore.setQuery(sql);
        setHistoryOpen(false);
      }
    },
    [activeTabId, activeQueryTab, updateTab, queryStore],
  );

  return {
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
    historyOpen,
    savedQueriesOpen,
    saveDialogOpen,
    cursorPosition,
    tabPagination,
    queryHistory: queryStore.queryHistory,

    updateTab,
    getActiveQueryTab,
    addToHistory,
    clearHistory,
    setHistoryOpen,
    setSavedQueriesOpen,
    setSaveDialogOpen,
    setCursorPosition,
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
  };
}
