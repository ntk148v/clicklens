"use client";

import { useState, useRef, useCallback } from "react";
import type { LogEntry } from "./use-logs";

interface UseLogStreamConfig<P> {
  fetchUrl: string;
  queryParams: P;
  /** Callback to transform raw JSON to LogEntry (if needed) */
  // transform?: (item: any) => LogEntry;
}

interface UseLogStreamResult {
  logs: LogEntry[];
  isLoading: boolean;
  totalHits: number;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>; // History (Append)
  loadLive: () => Promise<void>; // Live (Prepend)
  reload: () => Promise<void>; // Reset
}

export function useLogStream<P extends Record<string, unknown>>({
  fetchUrl,
  queryParams,
}: UseLogStreamConfig<P>): UseLogStreamResult {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Newest timestamp seen (for Live Mode)
  const newestTimestampRef = useRef<string | null>(null);
  // Oldest timestamp seen (for History Mode / Cursor)
  const oldestTimestampRef = useRef<string | null>(null);

  // Abort controller to cancel prev requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchStream = useCallback(
    async (mode: "initial" | "history" | "live", params: URLSearchParams) => {
      setIsLoading(true);
      setError(null);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const res = await fetch(`${fetchUrl}?${params.toString()}`, {
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          // Try parse error json
          try {
            const json = await res.json();
            throw new Error(json.error || res.statusText);
          } catch {
            throw new Error(res.statusText);
          }
        }

        if (!res.body) throw new Error("No response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const newItems: LogEntry[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);

              if (json.meta) {
                if (typeof json.meta.totalHits === "number") {
                  setTotalHits(json.meta.totalHits);
                }
                continue;
              }
              if (json.error) {
                console.error("Stream error in chunk", json.error);
                continue;
              }

              newItems.push(json as LogEntry);
            } catch (e) {
              console.error("JSON parse error", e);
            }
          }
        }

        if (newItems.length > 0) {
          // Processing items
          // Sort? They typically come sorted from DB.

          // Deduplication helper
          const getKey = (item: LogEntry) =>
            `${item.timestamp}_${item.component}_${item.message?.slice(0, 20)}`;

          if (mode === "initial") {
            setLogs(newItems);
            newestTimestampRef.current = newItems[0]?.timestamp as string;
            oldestTimestampRef.current = newItems[newItems.length - 1]
              ?.timestamp as string;
            setHasMore(newItems.length > 0);
          } else if (mode === "history") {
            setLogs((prev) => {
              const existingKeys = new Set(prev.map(getKey));
              const filtered = newItems.filter(
                (i) => !existingKeys.has(getKey(i)),
              );
              return [...prev, ...filtered];
            });
            // Update oldest
            oldestTimestampRef.current = newItems[newItems.length - 1]
              ?.timestamp as string;
            if (newItems.length === 0) setHasMore(false);
          } else if (mode === "live") {
            setLogs((prev) => {
              const existingKeys = new Set(prev.map(getKey));
              const filtered = newItems.filter(
                (i) => !existingKeys.has(getKey(i)),
              );
              // New items on TOP
              return [...filtered, ...prev];
            });
            // Update newest
            if (newItems[0]?.timestamp) {
              newestTimestampRef.current = newItems[0].timestamp as string;
            }
          }
        } else {
          if (mode === "history") setHasMore(false);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to fetch");
      } finally {
        setIsLoading(false);
      }
    },
    [fetchUrl],
  );

  const reload = useCallback(async () => {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v) params.set(k, String(v));
    });
    // Initial load: no cursor, no minTime constraint (unless user specified range)
    // Assume params contains basic filters
    await fetchStream("initial", params);
  }, [fetchStream, queryParams]);

  const loadMore = useCallback(async () => {
    if (!oldestTimestampRef.current || !hasMore || isLoading) return;

    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v) params.set(k, String(v));
    });
    params.set("cursor", oldestTimestampRef.current);

    await fetchStream("history", params);
  }, [fetchStream, queryParams, hasMore, isLoading]);

  const loadLive = useCallback(async () => {
    if (!newestTimestampRef.current || isLoading) return;

    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v) params.set(k, String(v));
    });
    params.set("minTime", newestTimestampRef.current);
    // Limit for live update?
    params.set("limit", "100");

    await fetchStream("live", params);
  }, [fetchStream, queryParams, isLoading]);

  return {
    logs,
    isLoading,
    totalHits,
    error,
    hasMore,
    reload,
    loadMore,
    loadLive,
  };
}
