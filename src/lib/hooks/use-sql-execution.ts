"use client";

import { useState, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";
import { generateUUID } from "@/lib/utils";
import { QueryCancellationManager } from "@/lib/clickhouse/cancellation";
import type { QueryTab, QueryHistoryEntry } from "@/lib/store/tabs";

interface User {
  host: string;
  username: string;
  database: string;
}

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

/**
 * Options for the useSqlExecution hook
 */
export interface UseSqlExecutionOptions {
  cancellationManager: QueryCancellationManager;
  csrfToken: string | null;
  selectedDatabase: string | null;
  user: User | null;
  updateTab: (id: string, updates: Partial<QueryTab>) => void;
  getActiveQueryTab: () => QueryTab | undefined;
  addToHistory: (entry: Omit<QueryHistoryEntry, "id" | "timestamp">) => void;
}

/**
 * Return value for the useSqlExecution hook
 */
export interface UseSqlExecutionReturn {
  execute: (sql: string, page?: number, pageSize?: number) => Promise<void>;
  isExecuting: boolean;
}

/**
 * Extract error information from various error types
 */
function getErrorInfo(error: unknown): ApiError {
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
}

/**
 * Hook for managing SQL query execution with NDJSON streaming
 * Handles query cancellation, streaming data, error handling, and history tracking
 */
export function useSqlExecution(
  options: UseSqlExecutionOptions
): UseSqlExecutionReturn {
  const {
    cancellationManager,
    csrfToken,
    selectedDatabase,
    user,
    updateTab,
    getActiveQueryTab,
    addToHistory,
  } = options;

  const [isExecuting, setIsExecuting] = useState(false);

  const execute = useCallback(
    async (sql: string, page: number = 0, pageSize: number = 100) => {
      const tab = getActiveQueryTab();
      if (!tab || tab.isRunning) return;

      const trimmedSql = sql.trim();
      if (!trimmedSql) return;

      const { splitSqlStatements } = await import("@/lib/sql");
      const statements = splitSqlStatements(trimmedSql);

      if (statements.length === 0) return;

      const queryId = generateUUID();
      updateTab(tab.id, { isRunning: true, error: null, queryId });
      setIsExecuting(true);

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

          const controller = cancellationManager.createController(queryId);

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
            signal: controller.signal,
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
            sql: trimmedSql,
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
            sql: trimmedSql,
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
          sql: trimmedSql,
          error: errorInfo.userMessage,
        });
      } finally {
        setIsExecuting(false);
      }
    },
    [
      getActiveQueryTab,
      updateTab,
      addToHistory,
      user,
      selectedDatabase,
      csrfToken,
      cancellationManager,
    ]
  );

  return {
    execute,
    isExecuting,
  };
}