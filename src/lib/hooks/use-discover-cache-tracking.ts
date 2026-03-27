"use client";

import { useState, useRef, useCallback } from "react";
import type { FlexibleTimeRange } from "@/lib/types/discover";
import type { SortingState } from "@tanstack/react-table";

export interface CacheMetadata {
  isCached: boolean;
  cacheAge: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
}

interface CacheTrackingState {
  totalHits: number;
  totalMisses: number;
  lastQueryKey: string | null;
  lastCacheTimestamp: number | null;
}

export interface QueryParams {
  filter: string;
  flexibleRange: FlexibleTimeRange;
  columns: string[];
  timeColumn: string;
  sorting: SortingState;
  groupBy: string[];
}

export interface UseDiscoverCacheTrackingOptions {
  lastExecutedParams: QueryParams | null;
}

export interface UseDiscoverCacheTrackingReturn {
  cacheMetadata: CacheMetadata | undefined;
  trackQuery: (params: QueryParams) => void;
  resetTracking: () => void;
}

/**
 * Hook for tracking client-side cache metadata
 * Monitors query cache hits/misses and calculates hit rates
 */
export function useDiscoverCacheTracking(
  options: UseDiscoverCacheTrackingOptions
): UseDiscoverCacheTrackingReturn {
  const { lastExecutedParams } = options;

  const [cacheMetadata, setCacheMetadata] = useState<CacheMetadata | undefined>();
  const cacheTrackingRef = useRef<CacheTrackingState>({
    totalHits: 0,
    totalMisses: 0,
    lastQueryKey: null,
    lastCacheTimestamp: null,
  });

  const trackQuery = useCallback(
    (params: QueryParams) => {
      const queryKey = JSON.stringify(params);

      const isFromCache =
        lastExecutedParams !== null && JSON.stringify(lastExecutedParams) === queryKey;

      const now = Date.now();

      if (cacheTrackingRef.current.lastQueryKey !== queryKey) {
        cacheTrackingRef.current.lastQueryKey = queryKey;
        cacheTrackingRef.current.totalHits = 0;
        cacheTrackingRef.current.totalMisses = 0;
        cacheTrackingRef.current.lastCacheTimestamp = null;
      }

      if (isFromCache) {
        cacheTrackingRef.current.totalHits++;
      } else {
        cacheTrackingRef.current.totalMisses++;
        cacheTrackingRef.current.lastCacheTimestamp = now;
      }

      const cacheAge = cacheTrackingRef.current.lastCacheTimestamp
        ? now - cacheTrackingRef.current.lastCacheTimestamp
        : 0;

      const total = cacheTrackingRef.current.totalHits + cacheTrackingRef.current.totalMisses;
      const hitRate = total === 0 ? 0 : Math.round((cacheTrackingRef.current.totalHits / total) * 100);

      setCacheMetadata({
        isCached: isFromCache,
        cacheAge,
        hitRate,
        totalHits: cacheTrackingRef.current.totalHits,
        totalMisses: cacheTrackingRef.current.totalMisses,
      });
    },
    [lastExecutedParams]
  );

  const resetTracking = useCallback(() => {
    cacheTrackingRef.current = {
      totalHits: 0,
      totalMisses: 0,
      lastQueryKey: null,
      lastCacheTimestamp: null,
    };
    setCacheMetadata(undefined);
  }, []);

  return {
    cacheMetadata,
    trackQuery,
    resetTracking,
  };
}
