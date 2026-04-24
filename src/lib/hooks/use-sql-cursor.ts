"use client";

import { useState, useCallback } from "react";
import { fetchApi } from "@/lib/api/client";
import { QueryCancellationManager } from "@/lib/clickhouse/cancellation";
import { findStatementAtPosition } from "@/lib/sql";
import type { QueryTab, QueryHistoryEntry } from "@/lib/store/tabs";
import { generateUUID } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

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

export interface UseSqlCursorOptions {
  cancellationManager: QueryCancellationManager;
  csrfToken: string | null;
  selectedDatabase: string | null;
  user: User | null;
  updateTab: (id: string, updates: Partial<QueryTab>) => void;
  getActiveQueryTab: () => QueryTab | undefined;
  addToHistory: (entry: Omit<QueryHistoryEntry, "id" | "timestamp">) => void;
}

export interface UseSqlCursorReturn {
  cursorPosition: number;
  handleCursorChange: (position: number) => void;
  executeAtCursor: () => Promise<void>;
}

export function useSqlCursor({
  cancellationManager,
  csrfToken,
  selectedDatabase,
  user,
  updateTab,
  getActiveQueryTab,
  addToHistory,
}: UseSqlCursorOptions): UseSqlCursorReturn {
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleCursorChange = useCallback((position: number) => {
    setCursorPosition(position);
  }, []);

  const executeAtCursor = useCallback(async () => {
    const tab = getActiveQueryTab();
    if (!tab || tab.isRunning) return;

    const sql = tab.sql.trim();
    if (!sql) return;

    const statement = findStatementAtPosition(tab.sql, cursorPosition);

    if (!statement) return;

    const queryId = generateUUID();
    updateTab(tab.id, { isRunning: true, error: null, queryId });

    try {
      const controller = cancellationManager.createController(queryId);

      const response = await fetchApi("/api/clickhouse/query", {
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
    }
  }, [
    getActiveQueryTab,
    updateTab,
    addToHistory,
    user,
    cursorPosition,
    selectedDatabase,
    csrfToken,
    cancellationManager,
  ]);

  return {
    cursorPosition,
    handleCursorChange,
    executeAtCursor,
  };
}