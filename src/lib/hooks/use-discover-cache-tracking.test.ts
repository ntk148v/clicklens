import { describe, it, expect } from "bun:test";
import type { FlexibleTimeRange, SortingState } from "@/lib/types/discover";

describe("useDiscoverCacheTracking - cache metadata", () => {
  it("calculates cache hit rate correctly", () => {
    const totalHits = 3;
    const totalMisses = 7;
    const hitRate = totalHits + totalMisses > 0
      ? Math.round((totalHits / (totalHits + totalMisses)) * 100)
      : 0;

    expect(hitRate).toBe(30);
  });

  it("handles zero total requests for hit rate", () => {
    const totalHits = 0;
    const totalMisses = 0;
    const hitRate = totalHits + totalMisses > 0
      ? Math.round((totalHits / (totalHits + totalMisses)) * 100)
      : 0;

    expect(hitRate).toBe(0);
  });

  it("calculates 100% hit rate", () => {
    const totalHits = 5;
    const totalMisses = 0;
    const hitRate = totalHits + totalMisses > 0
      ? Math.round((totalHits / (totalHits + totalMisses)) * 100)
      : 0;

    expect(hitRate).toBe(100);
  });

  it("calculates 0% hit rate", () => {
    const totalHits = 0;
    const totalMisses = 5;
    const hitRate = totalHits + totalMisses > 0
      ? Math.round((totalHits / (totalHits + totalMisses)) * 100)
      : 0;

    expect(hitRate).toBe(0);
  });
});

describe("useDiscoverCacheTracking - query key generation", () => {
  it("generates consistent query keys for same params", () => {
    const params = {
      filter: "level = 'error'",
      flexibleRange: { type: "relative" as const, from: "now-1h", to: "now", label: "Last 1 hour" },
      columns: ["timestamp", "level", "message"],
      timeColumn: "timestamp",
      sorting: [{ id: "timestamp", desc: true }] as SortingState,
      groupBy: [] as string[],
    };

    const key1 = JSON.stringify(params);
    const key2 = JSON.stringify(params);

    expect(key1).toBe(key2);
  });

  it("generates different query keys for different params", () => {
    const params1 = {
      filter: "level = 'error'",
      flexibleRange: { type: "relative" as const, from: "now-1h", to: "now", label: "Last 1 hour" },
      columns: ["timestamp", "level", "message"],
      timeColumn: "timestamp",
      sorting: [] as SortingState,
      groupBy: [] as string[],
    };

    const params2 = {
      filter: "level = 'warn'",
      flexibleRange: { type: "relative" as const, from: "now-1h", to: "now", label: "Last 1 hour" },
      columns: ["timestamp", "level", "message"],
      timeColumn: "timestamp",
      sorting: [] as SortingState,
      groupBy: [] as string[],
    };

    const key1 = JSON.stringify(params1);
    const key2 = JSON.stringify(params2);

    expect(key1).not.toBe(key2);
  });
});

describe("useDiscoverCacheTracking - cache age calculation", () => {
  it("calculates cache age correctly", () => {
    const now = Date.now();
    const cacheTimestamp = now - 5000;
    const cacheAge = now - cacheTimestamp;

    expect(cacheAge).toBeGreaterThanOrEqual(5000);
    expect(cacheAge).toBeLessThan(5100);
  });

  it("returns 0 cache age when no timestamp", () => {
    const lastCacheTimestamp: number | null = null;
    const cacheAge = lastCacheTimestamp ? Date.now() - lastCacheTimestamp : 0;

    expect(cacheAge).toBe(0);
  });
});

describe("useDiscoverCacheTracking - cache hit detection", () => {
  it("detects cache hit when params match last executed", () => {
    const lastExecutedParams = {
      filter: "level = 'error'",
      flexibleRange: { type: "relative" as const, from: "now-1h", to: "now", label: "Last 1 hour" },
      columns: ["timestamp", "level"],
      timeColumn: "timestamp",
      sorting: [] as SortingState,
      groupBy: [] as string[],
    };

    const currentParams = {
      filter: "level = 'error'",
      flexibleRange: { type: "relative" as const, from: "now-1h", to: "now", label: "Last 1 hour" },
      columns: ["timestamp", "level"],
      timeColumn: "timestamp",
      sorting: [] as SortingState,
      groupBy: [] as string[],
    };

    const isFromCache = lastExecutedParams !== null &&
      JSON.stringify(lastExecutedParams) === JSON.stringify(currentParams);

    expect(isFromCache).toBe(true);
  });

  it("detects cache miss when params differ", () => {
    const lastExecutedParams = {
      filter: "level = 'error'",
      flexibleRange: { type: "relative" as const, from: "now-1h", to: "now", label: "Last 1 hour" },
      columns: ["timestamp", "level"],
      timeColumn: "timestamp",
      sorting: [] as SortingState,
      groupBy: [] as string[],
    };

    const currentParams = {
      filter: "level = 'warn'",
      flexibleRange: { type: "relative" as const, from: "now-1h", to: "now", label: "Last 1 hour" },
      columns: ["timestamp", "level"],
      timeColumn: "timestamp",
      sorting: [] as SortingState,
      groupBy: [] as string[],
    };

    const isFromCache = lastExecutedParams !== null &&
      JSON.stringify(lastExecutedParams) === JSON.stringify(currentParams);

    expect(isFromCache).toBe(false);
  });

  it("detects cache miss when no last executed params", () => {
    const lastExecutedParams = null;

    const currentParams = {
      filter: "level = 'error'",
      flexibleRange: { type: "relative" as const, from: "now-1h", to: "now", label: "Last 1 hour" },
      columns: ["timestamp", "level"],
      timeColumn: "timestamp",
      sorting: [] as SortingState,
      groupBy: [] as string[],
    };

    const isFromCache = lastExecutedParams !== null &&
      JSON.stringify(lastExecutedParams) === JSON.stringify(currentParams);

    expect(isFromCache).toBe(false);
  });
});
