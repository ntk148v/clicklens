"use client";

import { useState, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";
import type { QueryTab } from "@/lib/store/tabs";

export type ExplainType = "AST" | "SYNTAX" | "PLAN" | "PIPELINE";

interface ApiError {
  code: number;
  type: string;
  category?: string;
  message: string;
  userMessage: string;
  hint?: string;
}

/**
 * Options for the useSqlExplain hook
 */
export interface UseSqlExplainOptions {
  csrfToken: string | null;
  selectedDatabase: string | null;
  updateTab: (id: string, updates: Partial<QueryTab>) => void;
  getActiveQueryTab: () => QueryTab | undefined;
}

/**
 * Return value for the useSqlExplain hook
 */
export interface UseSqlExplainReturn {
  explain: (type: ExplainType) => Promise<void>;
  isExplaining: boolean;
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

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return {
      code: 0,
      message: error.message,
      type: "UNKNOWN_ERROR",
      category: "UNKNOWN",
      userMessage: "Failed to explain query",
      hint: error.message,
    };
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
 * Hook for managing SQL EXPLAIN queries
 * Handles EXPLAIN AST, SYNTAX, PLAN, and PIPELINE queries with NDJSON streaming
 */
export function useSqlExplain(
  options: UseSqlExplainOptions
): UseSqlExplainReturn {
  const { csrfToken, selectedDatabase, updateTab, getActiveQueryTab } =
    options;

  const [isExplaining, setIsExplaining] = useState(false);

  const explain = useCallback(
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

      setIsExplaining(true);

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
              throw event.error;
            }
          } catch (e) {
            // If it's an error event, re-throw it
            if (e && typeof e === "object" && "message" in e) {
              throw e;
            }
            // Otherwise ignore JSON parse errors
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
      } finally {
        setIsExplaining(false);
      }
    },
    [getActiveQueryTab, updateTab, selectedDatabase, csrfToken],
  );

  return {
    explain,
    isExplaining,
  };
}