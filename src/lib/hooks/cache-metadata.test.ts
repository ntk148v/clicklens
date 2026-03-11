import { describe, it, expect } from "bun:test";
import {
  calculateHitRate,
  updateCacheMetadata,
  type CacheTrackingState,
} from "./cache-metadata";

describe("cache metadata tracking", () => {
  it("initializes with zero hits and misses", () => {
    const state: CacheTrackingState = {
      totalHits: 0,
      totalMisses: 0,
      lastQueryKey: null,
      lastCacheTimestamp: null,
    };

    const metadata = updateCacheMetadata(state, "query1", false);

    expect(metadata.totalHits).toBe(0);
    expect(metadata.totalMisses).toBe(1);
    expect(metadata.hitRate).toBe(0);
    expect(metadata.isCached).toBe(false);
  });

  it("tracks cache miss on first query", () => {
    const state: CacheTrackingState = {
      totalHits: 0,
      totalMisses: 0,
      lastQueryKey: null,
      lastCacheTimestamp: null,
    };

    const metadata = updateCacheMetadata(state, "query1", false);

    expect(metadata.isCached).toBe(false);
    expect(metadata.totalHits).toBe(0);
    expect(metadata.totalMisses).toBe(1);
    expect(metadata.hitRate).toBe(0);
  });

  it("tracks cache hit on subsequent identical query", () => {
    const state: CacheTrackingState = {
      totalHits: 0,
      totalMisses: 0,
      lastQueryKey: null,
      lastCacheTimestamp: null,
    };

    updateCacheMetadata(state, "query1", false);
    const metadata = updateCacheMetadata(state, "query1", true);

    expect(metadata.isCached).toBe(true);
    expect(metadata.totalHits).toBe(1);
    expect(metadata.totalMisses).toBe(1);
    expect(metadata.hitRate).toBe(50);
  });

  it("resets tracking when query key changes", () => {
    const state: CacheTrackingState = {
      totalHits: 5,
      totalMisses: 3,
      lastQueryKey: "query1",
      lastCacheTimestamp: Date.now() - 1000,
    };

    const metadata = updateCacheMetadata(state, "query2", false);

    expect(metadata.totalHits).toBe(0);
    expect(metadata.totalMisses).toBe(1);
    expect(metadata.hitRate).toBe(0);
    expect(state.lastQueryKey).toBe("query2");
  });

  it("calculates hit rate correctly", () => {
    const state: CacheTrackingState = {
      totalHits: 0,
      totalMisses: 0,
      lastQueryKey: null,
      lastCacheTimestamp: null,
    };

    updateCacheMetadata(state, "query1", false);
    updateCacheMetadata(state, "query1", true);
    updateCacheMetadata(state, "query1", false);
    updateCacheMetadata(state, "query1", true);
    updateCacheMetadata(state, "query1", false);

    const metadata = updateCacheMetadata(state, "query1", true);

    expect(metadata.totalHits).toBe(3);
    expect(metadata.totalMisses).toBe(3);
    expect(metadata.hitRate).toBe(50);
  });

  it("handles all cache hits", () => {
    const state: CacheTrackingState = {
      totalHits: 0,
      totalMisses: 0,
      lastQueryKey: null,
      lastCacheTimestamp: null,
    };

    updateCacheMetadata(state, "query1", false);

    for (let i = 0; i < 4; i++) {
      updateCacheMetadata(state, "query1", true);
    }

    const metadata = updateCacheMetadata(state, "query1", true);

    expect(metadata.totalHits).toBe(5);
    expect(metadata.totalMisses).toBe(1);
    expect(metadata.hitRate).toBe(83);
  });

  it("handles all cache misses", () => {
    const state: CacheTrackingState = {
      totalHits: 0,
      totalMisses: 0,
      lastQueryKey: null,
      lastCacheTimestamp: null,
    };

    for (let i = 0; i < 4; i++) {
      updateCacheMetadata(state, "query1", false);
    }

    const metadata = updateCacheMetadata(state, "query1", false);

    expect(metadata.totalHits).toBe(0);
    expect(metadata.totalMisses).toBe(5);
    expect(metadata.hitRate).toBe(0);
  });

  it("tracks cache age in milliseconds", async () => {
    const state: CacheTrackingState = {
      totalHits: 0,
      totalMisses: 0,
      lastQueryKey: null,
      lastCacheTimestamp: null,
    };

    const beforeMiss = Date.now();
    updateCacheMetadata(state, "query1", false);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const metadata = updateCacheMetadata(state, "query1", true);

    expect(metadata.cacheAge).toBeGreaterThanOrEqual(100);
    expect(metadata.cacheAge).toBeLessThanOrEqual(
      Date.now() - beforeMiss + 10,
    );
  });

  it("handles zero total requests", () => {
    const hitRate = calculateHitRate(0, 0);

    expect(hitRate).toBe(0);
  });
});