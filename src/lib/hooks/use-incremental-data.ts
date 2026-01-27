"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Configuration for incremental data fetching
 */
export interface IncrementalDataConfig<T, P extends Record<string, unknown>> {
  /**
   * Function to fetch data from API
   * @param params - Query parameters including optional `sinceTimestamp` for incremental fetch
   * @returns Promise resolving to fetched items
   */
  fetchFn: (params: P & { sinceTimestamp?: string }) => Promise<T[]>;

  /**
   * Function to extract timestamp from an item (used for tracking newest item)
   * @param item - Data item
   * @returns ISO timestamp string
   */
  getTimestamp: (item: T) => string;

  /**
   * Function to get unique key for deduplication
   * @param item - Data item
   * @returns Unique string key
   */
  getKey: (item: T) => string;

  /**
   * Maximum number of items to keep in memory
   * @default 5000
   */
  limit?: number;
}

export interface UseIncrementalDataResult<T> {
  /** Current accumulated data */
  data: T[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Perform full reload (clears existing data) */
  reload: () => Promise<void>;
  /** Fetch only new data and prepend to existing */
  fetchNew: () => Promise<void>;
  /** Clear all data */
  clear: () => void;
  /** Newest timestamp in current data */
  newestTimestamp: string | null;
}

/**
 * Hook for managing append-only data with incremental refresh
 *
 * Use this for data that only grows (logs, events, audit trails) where:
 * - New items are prepended to the list
 * - Old items are never modified
 * - Refreshing should fetch only new items since last fetch
 *
 * @example
 * ```tsx
 * const { data, reload, fetchNew } = useIncrementalData<LogEntry>({
 *   fetchFn: async (params) => {
 *     const res = await fetch(`/api/logs?since=${params.sinceTimestamp || ''}`);
 *     return res.json();
 *   },
 *   getTimestamp: (log) => log.timestamp,
 *   getKey: (log) => `${log.timestamp}_${log.id}`,
 * });
 * ```
 */
export function useIncrementalData<
  T,
  P extends Record<string, unknown> = Record<string, unknown>
>(config: IncrementalDataConfig<T, P>, params: P): UseIncrementalDataResult<T> {
  const { fetchFn, getTimestamp, getKey, limit = 5000 } = config;

  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the newest timestamp for incremental fetching
  const newestTimestampRef = useRef<string | null>(null);

  /**
   * Full reload - clears existing data and fetches fresh
   */
  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const items = await fetchFn(params);
      setData(items);

      // Update newest timestamp
      if (items.length > 0) {
        newestTimestampRef.current = getTimestamp(items[0]);
      } else {
        newestTimestampRef.current = null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, params, getTimestamp]);

  /**
   * Incremental fetch - only gets new data and prepends
   */
  const fetchNew = useCallback(async () => {
    // If no existing data, do a full reload
    if (!newestTimestampRef.current) {
      return reload();
    }

    setIsLoading(true);

    try {
      const items = await fetchFn({
        ...params,
        sinceTimestamp: newestTimestampRef.current,
      });

      if (items.length > 0) {
        // Deduplicate and prepend, respecting the limit
        setData((prev) => {
          const existingKeys = new Set(prev.map(getKey));
          const uniqueNew = items.filter(
            (item) => !existingKeys.has(getKey(item))
          );
          const merged = [...uniqueNew, ...prev];
          return merged.slice(0, limit);
        });

        // Update newest timestamp
        newestTimestampRef.current = getTimestamp(items[0]);
      }
    } catch (err) {
      console.error("Failed to fetch new data:", err);
      // Don't set error for incremental fetch - keep showing existing data
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, params, getTimestamp, getKey, reload, limit]);

  /**
   * Clear all data
   */
  const clear = useCallback(() => {
    setData([]);
    newestTimestampRef.current = null;
    setError(null);
  }, []);

  return {
    data,
    isLoading,
    error,
    reload,
    fetchNew,
    clear,
    newestTimestamp: newestTimestampRef.current,
  };
}
