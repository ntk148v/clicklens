import { describe, test, expect, beforeEach } from "bun:test";
import { LRUCache } from "lru-cache";
import { getOrSet, clearCache, invalidateCache } from "./index";

// Helper: create a short-lived cache for testing
const createTestCache = (ttl = 500) =>
  new LRUCache<string, unknown>({ max: 10, ttl });

describe("Cache Module", () => {
  let cache: LRUCache<string, unknown>;

  beforeEach(() => {
    cache = createTestCache();
  });

  describe("getOrSet", () => {
    test("calls fetcher on cache miss and caches result", async () => {
      let callCount = 0;
      const fetcher = async () => {
        callCount++;
        return { databases: ["default", "test"] };
      };

      const result = await getOrSet(cache, "test-key", fetcher);
      expect(result).toEqual({ databases: ["default", "test"] });
      expect(callCount).toBe(1);

      // Second call should return cached value
      const result2 = await getOrSet(cache, "test-key", fetcher);
      expect(result2).toEqual({ databases: ["default", "test"] });
      expect(callCount).toBe(1); // Fetcher not called again
    });

    test("returns cached value on cache hit", async () => {
      cache.set("existing", "cached-value");

      let fetcherCalled = false;
      const result = await getOrSet(cache, "existing", async () => {
        fetcherCalled = true;
        return "fresh-value";
      });

      expect(result).toBe("cached-value");
      expect(fetcherCalled).toBe(false);
    });

    test("deduplicates concurrent requests for same key", async () => {
      let callCount = 0;
      const fetcher = async () => {
        callCount++;
        // Simulate a slow query
        await new Promise((r) => setTimeout(r, 50));
        return "result";
      };

      // Fire 3 concurrent requests for the same key
      const [r1, r2, r3] = await Promise.all([
        getOrSet(cache, "dedup-key", fetcher),
        getOrSet(cache, "dedup-key", fetcher),
        getOrSet(cache, "dedup-key", fetcher),
      ]);

      expect(r1).toBe("result");
      expect(r2).toBe("result");
      expect(r3).toBe("result");
      expect(callCount).toBe(1); // Only one fetch
    });

    test("different keys trigger separate fetches", async () => {
      let callCount = 0;
      const fetcher = async () => {
        callCount++;
        return `result-${callCount}`;
      };

      const [r1, r2] = await Promise.all([
        getOrSet(cache, "key-a", fetcher),
        getOrSet(cache, "key-b", fetcher),
      ]);

      expect(callCount).toBe(2);
      expect(r1).not.toBe(r2);
    });

    test("retries after a failed fetch", async () => {
      let callCount = 0;
      const failingFetcher = async () => {
        callCount++;
        throw new Error("ClickHouse unavailable");
      };

      // First call fails
      try {
        await getOrSet(cache, "fail-key", failingFetcher);
      } catch {
        // expected
      }
      expect(callCount).toBe(1);

      // Second call should try again (inflight cleared on failure)
      const successFetcher = async () => "recovered";
      const result = await getOrSet(cache, "fail-key", successFetcher);
      expect(result).toBe("recovered");
    });

    test("respects TTL expiration", async () => {
      const shortCache = createTestCache(50); // 50ms TTL
      let callCount = 0;
      const fetcher = async () => {
        callCount++;
        return `value-${callCount}`;
      };

      const r1 = await getOrSet(shortCache, "ttl-key", fetcher);
      expect(r1).toBe("value-1");

      // Wait for TTL to expire
      await new Promise((r) => setTimeout(r, 100));

      const r2 = await getOrSet(shortCache, "ttl-key", fetcher);
      expect(r2).toBe("value-2"); // Fresh fetch
      expect(callCount).toBe(2);
    });
  });

  describe("invalidateCache", () => {
    test("removes a specific key", async () => {
      cache.set("key-1", "value-1");
      cache.set("key-2", "value-2");

      invalidateCache(cache, "key-1");

      expect(cache.get("key-1")).toBeUndefined();
      expect(cache.get("key-2")).toBe("value-2");
    });
  });

  describe("clearCache", () => {
    test("removes all entries", async () => {
      cache.set("key-1", "value-1");
      cache.set("key-2", "value-2");

      clearCache(cache);

      expect(cache.get("key-1")).toBeUndefined();
      expect(cache.get("key-2")).toBeUndefined();
      expect(cache.size).toBe(0);
    });
  });
});
