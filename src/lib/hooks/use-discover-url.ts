"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { format } from "date-fns";
import type { FlexibleTimeRange, TimeRange } from "@/lib/types/discover";
import { getFlexibleRangeFromEnum } from "@/lib/types/discover";

const VALID_RELATIVE_RANGES = new Set([
  "5m",
  "15m",
  "30m",
  "1h",
  "3h",
  "6h",
  "12h",
  "24h",
  "3d",
  "7d",
]);

export interface URLParams {
  database: string | null;
  table: string | null;
  filter: string | null;
  page: number;
  timeRange: FlexibleTimeRange | null;
}

export interface UseDiscoverURLOptions {
  selectedDatabase: string;
  selectedTable: string;
  appliedFilter: string;
  flexibleRange: FlexibleTimeRange;
  page: number;
  onHydrated?: () => void;
}

export interface UseDiscoverURLReturn {
  /** Parsed URL parameters on initial load */
  urlParams: URLParams;
  /** Whether URL has been hydrated from initial load */
  isHydrated: boolean;
  /** Sync current state to URL (debounced) */
  syncToURL: () => void;
}

/**
 * Parse time range from URL search params
 */
export function parseTimeRangeFromURL(
  params: URLSearchParams,
): FlexibleTimeRange | null {
  const t = params.get("t");
  if (t && VALID_RELATIVE_RANGES.has(t)) {
    return getFlexibleRangeFromEnum(t as TimeRange);
  }

  const start = params.get("start");
  const end = params.get("end");
  if (start) {
    const from = start;
    const to = end || "now";
    try {
      const fromDate = new Date(from);
      const toDate = to === "now" ? new Date() : new Date(to);
      if (isNaN(fromDate.getTime())) return null;
      return {
        type: "absolute",
        from,
        to,
        label: `${format(fromDate, "MMM d, HH:mm")} to ${format(toDate, "MMM d, HH:mm")}`,
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Hook for managing URL parameter parsing and syncing
 * Handles initial hydration from URL and syncing state back to URL
 */
export function useDiscoverURL(options: UseDiscoverURLOptions): UseDiscoverURLReturn {
  const { selectedDatabase, selectedTable, appliedFilter, flexibleRange, page, onHydrated } = options;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const hydratedRef = useRef(false);
  const urlSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse URL params once on mount
  const urlParams: URLParams = {
    database: searchParams.get("db"),
    table: searchParams.get("table"),
    filter: searchParams.get("filter"),
    page: (() => {
      const urlPage = searchParams.get("page");
      const p = urlPage ? parseInt(urlPage, 10) : 1;
      return !isNaN(p) && p > 0 ? p : 1;
    })(),
    timeRange: parseTimeRangeFromURL(searchParams),
  };

  // Store searchParams in a ref to avoid dependency issues
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  // Sync state to URL (debounced)
  const syncToURL = useCallback(() => {
    if (!hydratedRef.current) return;

    if (urlSyncTimerRef.current) clearTimeout(urlSyncTimerRef.current);
    urlSyncTimerRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (selectedDatabase) params.set("db", selectedDatabase);
      if (selectedTable) params.set("table", selectedTable);
      if (appliedFilter) params.set("filter", appliedFilter);

      if (flexibleRange.type === "relative") {
        const rangeKey = flexibleRange.from.replace("now-", "");
        params.set("t", rangeKey);
      } else {
        params.set("start", flexibleRange.from);
        if (flexibleRange.to !== "now") {
          params.set("end", flexibleRange.to);
        }
      }

      if (page > 1) params.set("page", String(page));

      const newSearch = params.toString();
      const currentSearch = searchParamsRef.current.toString();
      if (newSearch !== currentSearch) {
        router.replace(`${pathname}?${newSearch}`, { scroll: false });
      }
    }, 300);
  }, [selectedDatabase, selectedTable, appliedFilter, flexibleRange, page, pathname, router]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (urlSyncTimerRef.current) clearTimeout(urlSyncTimerRef.current);
    };
  }, []);

  // Mark as hydrated after initial render
  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      onHydrated?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    urlParams,
    isHydrated: hydratedRef.current,
    syncToURL,
  };
}
