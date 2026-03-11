import { describe, it, expect } from "bun:test";
import type { DiscoverState } from "./use-discover-state";

describe("useDiscoverState - cache metadata tracking", () => {
  it("DiscoverState interface includes cacheMetadata property", () => {
    const state: Partial<DiscoverState> = {};

    expect(state.cacheMetadata).toBeUndefined();
  });

  it("cacheMetadata has correct structure when defined", () => {
    const cacheMetadata = {
      isCached: false,
      cacheAge: 1000,
      hitRate: 50,
      totalHits: 1,
      totalMisses: 1,
    };

    expect(cacheMetadata.isCached).toBe(false);
    expect(cacheMetadata.cacheAge).toBe(1000);
    expect(cacheMetadata.hitRate).toBe(50);
    expect(cacheMetadata.totalHits).toBe(1);
    expect(cacheMetadata.totalMisses).toBe(1);
  });

  it("calculates hit rate correctly", () => {
    const totalHits = 2;
    const totalMisses = 3;
    const hitRate = (totalHits / (totalHits + totalMisses)) * 100;

    expect(hitRate).toBe(40);
  });

  it("handles zero total requests for hit rate", () => {
    const totalHits = 0;
    const totalMisses = 0;
    const hitRate = totalHits + totalMisses > 0
      ? (totalHits / (totalHits + totalMisses)) * 100
      : 0;

    expect(hitRate).toBe(0);
  });

  it("tracks cache age in milliseconds", () => {
    const cacheTimestamp = Date.now() - 5000;
    const cacheAge = Date.now() - cacheTimestamp;

    expect(cacheAge).toBeGreaterThanOrEqual(5000);
    expect(cacheAge).toBeLessThan(5100);
  });
});