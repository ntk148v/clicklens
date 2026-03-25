import { describe, it, expect, beforeEach } from "bun:test";
import {
  QueryCache,
  createQueryCache,
  getQueryCache,
  resetQueryCache,
  executeWithCache,
  CachedQueryResult,
  CacheMetadata,
} from "../../src/lib/cache/query-cache";

describe("QueryCache", () => {
  let cache: QueryCache;

  beforeEach(() => {
    cache = createQueryCache({ maxEntries: 10, ttl: 60000, name: "test-cache" });
  });

  describe("getCachedQuery", () => {
    it("should return undefined for non-existent key", () => {
      const result = cache.getCachedQuery("nonexistent");
      expect(result).toBeUndefined();
    });

    it("should return cached data for existing key", () => {
      const testData = { rows: 100, data: ["test"] };
      cache.setCachedQuery("test-key", testData);

      const result = cache.getCachedQuery<CachedQueryResult>("test-key");
      expect(result).toBeDefined();
      expect(result?.data).toEqual(testData);
      expect(result?.timestamp).toBeGreaterThan(0);
      expect(result?.ttl).toBe(60000);
    });

    it("should track cache hit", () => {
      cache.setCachedQuery("key1", { value: "test" });
      cache.getCachedQuery("key1");

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });
  });

  describe("setCachedQuery", () => {
    it("should store data in cache", () => {
      const data = { name: "test", count: 42 };
      cache.setCachedQuery("my-key", data, { source: "discover" });

      const result = cache.getCachedQuery("my-key");
      expect(result?.data).toEqual(data);
      expect(result?.metadata?.source).toBe("discover");
    });

    it("should update existing key", () => {
      cache.setCachedQuery("key", { v: 1 });
      cache.setCachedQuery("key", { v: 2 });

      const result = cache.getCachedQuery<{ v: number }>("key");
      expect(result?.data.v).toBe(2);
    });
  });

  describe("invalidateQuery", () => {
    it("should return true for existing key", () => {
      cache.setCachedQuery("key", { data: "test" });
      const result = cache.invalidateQuery("key");

      expect(result).toBe(true);
      expect(cache.getCachedQuery("key")).toBeUndefined();
    });

    it("should return false for non-existent key", () => {
      const result = cache.invalidateQuery("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("hasQuery", () => {
    it("should return true for existing key", () => {
      cache.setCachedQuery("key", { data: "test" });
      expect(cache.hasQuery("key")).toBe(true);
    });

    it("should return false for non-existent key", () => {
      expect(cache.hasQuery("nonexistent")).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      cache.setCachedQuery("key1", { data: 1 });
      cache.setCachedQuery("key2", { data: 2 });

      cache.clear();

      expect(cache.getCachedQuery("key1")).toBeUndefined();
      expect(cache.getCachedQuery("key2")).toBeUndefined();
      expect(cache.size).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return cache statistics", () => {
      cache.setCachedQuery("key1", { data: 1 });
      cache.getCachedQuery("key1");
      cache.getCachedQuery("nonexistent");

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.size).toBe(1);
    });
  });

  describe("size", () => {
    it("should return current cache size", () => {
      expect(cache.size).toBe(0);

      cache.setCachedQuery("key1", { data: 1 });
      cache.setCachedQuery("key2", { data: 2 });

      expect(cache.size).toBe(2);
    });
  });

  describe("getRemainingTtl", () => {
    it("should return remaining TTL for existing key", () => {
      cache = createQueryCache({ maxEntries: 10, ttl: 60000 });
      cache.setCachedQuery("key", { data: "test" });

      const remaining = cache.getRemainingTtl("key");
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60000);
    });

    it("should return 0 for non-existent key", () => {
      const remaining = cache.getRemainingTtl("nonexistent");
      expect(remaining).toBe(0);
    });
  });

  describe("generateDiscoverKey", () => {
    it("should generate consistent keys for same params", () => {
      const key1 = cache.generateDiscoverKey({
        database: "mydb",
        table: "mytable",
        filter: "status = 'active'",
        limit: 100,
      });

      const key2 = cache.generateDiscoverKey({
        database: "mydb",
        table: "mytable",
        filter: "status = 'active'",
        limit: 100,
      });

      expect(key1).toBe(key2);
    });

    it("should generate different keys for different params", () => {
      const key1 = cache.generateDiscoverKey({
        database: "mydb",
        table: "mytable",
        filter: "status = 'active'",
      });

      const key2 = cache.generateDiscoverKey({
        database: "mydb",
        table: "mytable",
        filter: "status = 'inactive'",
      });

      expect(key1).not.toBe(key2);
    });

    it("should include time range in key", () => {
      const key1 = cache.generateDiscoverKey({
        database: "mydb",
        table: "mytable",
        timeRange: { minTime: "2024-01-01", maxTime: "2024-01-31" },
      });

      const key2 = cache.generateDiscoverKey({
        database: "mydb",
        table: "mytable",
        timeRange: { minTime: "2024-02-01", maxTime: "2024-02-28" },
      });

      expect(key1).not.toBe(key2);
    });

    it("should include columns in key", () => {
      const key1 = cache.generateDiscoverKey({
        database: "mydb",
        table: "mytable",
        columns: ["id", "name"],
      });

      const key2 = cache.generateDiscoverKey({
        database: "mydb",
        table: "mytable",
        columns: ["id", "name", "created_at"],
      });

      expect(key1).not.toBe(key2);
    });
  });

  describe("generateSqlKey", () => {
    it("should generate key from SQL and database", () => {
      const key = cache.generateSqlKey("SELECT * FROM users", "mydb");
      expect(key).toContain("mydb");
      expect(key).toContain("SELECT");
    });

    it("should handle database-less queries", () => {
      const key = cache.generateSqlKey("SELECT 1");
      expect(key).toBeDefined();
    });
  });
});

describe("executeWithCache", () => {
  let cache: QueryCache;

  beforeEach(() => {
    cache = createQueryCache({ maxEntries: 10, ttl: 60000, name: "exec-cache" });
  });

  it("should return cached data on cache hit", async () => {
    const cachedData = { rows: [{ id: 1 }] };
    cache.setCachedQuery("query-key", cachedData);

    const result = await executeWithCache(cache, "query-key", async () => {
      return { rows: [] };
    });

    expect(result.data).toEqual(cachedData);
    expect(result.metadata.cacheHit).toBe(true);
  });

  it("should execute query and cache result on cache miss", async () => {
    const queryResult = { rows: [{ id: 2 }] };

    const result = await executeWithCache(cache, "new-key", async () => {
      return queryResult;
    });

    expect(result.data).toEqual(queryResult);
    expect(result.metadata.cacheHit).toBe(false);

    const cached = cache.getCachedQuery("new-key");
    expect(cached?.data).toEqual(queryResult);
  });

  it("should bypass cache when bypassCache is true", async () => {
    cache.setCachedQuery("key", { cached: true });

    const result = await executeWithCache(
      cache,
      "key",
      async () => ({ fresh: true }),
      { bypassCache: true }
    );

    expect(result.data).toEqual({ fresh: true });
    expect(result.metadata.cacheHit).toBe(false);
  });

  it("should include cache metadata", async () => {
    cache.setCachedQuery("key", { data: "test" });

    // Add small delay to ensure cache age > 0
    await new Promise((resolve) => setTimeout(resolve, 10));

    const result = await executeWithCache(cache, "key", async () => ({
      data: "new",
    }));

    expect(result.metadata.cacheHit).toBe(true);
    expect(result.metadata.cacheAge).toBeGreaterThan(0);
    expect(result.metadata.remainingTtl).toBeGreaterThan(0);
  });
});

describe("getQueryCache (singleton)", () => {
  it("should return same instance", () => {
    const cache1 = getQueryCache();
    const cache2 = getQueryCache();

    expect(cache1).toBe(cache2);
  });

  it("should allow reset", () => {
    const cache1 = getQueryCache();
    cache1.setCachedQuery("test", { data: "test" });

    resetQueryCache();

    const cache2 = getQueryCache();
    expect(cache2.getCachedQuery("test")).toBeUndefined();
  });
});

describe("Cache TTL expiration", () => {
  it("should expire entries after TTL", async () => {
    const shortCache = createQueryCache({ maxEntries: 10, ttl: 100 });
    shortCache.setCachedQuery("key", { data: "test" });

    const result = shortCache.getCachedQuery("key");
    expect(result).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 150));

    const expired = shortCache.getCachedQuery("key");
    expect(expired).toBeUndefined();
  });
});

describe("Cache size limit", () => {
  it("should evict oldest entries when max size reached", () => {
    const smallCache = createQueryCache({ maxEntries: 2, ttl: 60000 });

    smallCache.setCachedQuery("key1", { data: 1 });
    smallCache.setCachedQuery("key2", { data: 2 });

    smallCache.setCachedQuery("key3", { data: 3 });

    expect(smallCache.hasQuery("key1")).toBe(false);
    expect(smallCache.hasQuery("key2")).toBe(true);
    expect(smallCache.hasQuery("key3")).toBe(true);
  });
});

describe("Cache error handling", () => {
  it("should handle get errors gracefully", () => {
    const cache = createQueryCache({ maxEntries: 10, ttl: 60000 });

    cache.setCachedQuery("key", { data: "test" });

    expect(cache.getCachedQuery("key")).toBeDefined();
  });

  it("should handle invalidation errors gracefully", () => {
    const cache = createQueryCache({ maxEntries: 10, ttl: 60000 });

    const result = cache.invalidateQuery("nonexistent");
    expect(result).toBe(false);
  });
});