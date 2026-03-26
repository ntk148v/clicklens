import { describe, it, expect, beforeEach } from "bun:test";
import { LRUCacheImpl, createLRUCache } from "../../src/lib/cache/lru-cache";

describe("LRUCacheImpl", () => {
  let cache: LRUCacheImpl;

  beforeEach(() => {
    cache = createLRUCache({
      max: 3,
      ttl: 1000,
      name: "test-cache",
    });
  });

  describe("basic operations", () => {
    it("should store and retrieve values", () => {
      cache.set("key1", { data: "value1" });
      const result = cache.get("key1");
      expect(result).toEqual({ data: "value1" });
    });

    it("should return undefined for non-existent keys", () => {
      const result = cache.get("nonexistent");
      expect(result).toBeUndefined();
    });

    it("should update existing values", () => {
      cache.set("key1", { data: "value1" });
      cache.set("key1", { data: "value2" });
      const result = cache.get("key1");
      expect(result).toEqual({ data: "value2" });
    });

    it("should delete values", () => {
      cache.set("key1", { data: "value1" });
      const deleted = cache.delete("key1");
      expect(deleted).toBe(true);
      expect(cache.get("key1")).toBeUndefined();
    });

    it("should return false when deleting non-existent key", () => {
      const deleted = cache.delete("nonexistent");
      expect(deleted).toBe(false);
    });

    it("should clear all values", () => {
      cache.set("key1", { data: "value1" });
      cache.set("key2", { data: "value2" });
      cache.clear();
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBeUndefined();
      expect(cache.size).toBe(0);
    });
  });

  describe("cache metadata", () => {
    it("should track size correctly", () => {
      expect(cache.size).toBe(0);
      cache.set("key1", { data: "value1" });
      expect(cache.size).toBe(1);
      cache.set("key2", { data: "value2" });
      expect(cache.size).toBe(2);
    });

    it("should return all keys", () => {
      cache.set("key1", { data: "value1" });
      cache.set("key2", { data: "value2" });
      const keys = cache.keys();
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
    });

    it("should check if key exists", () => {
      cache.set("key1", { data: "value1" });
      expect(cache.has("key1")).toBe(true);
      expect(cache.has("nonexistent")).toBe(false);
    });

    it("should peek without updating recency", () => {
      cache.set("key1", { data: "value1" });
      const result = cache.peek("key1");
      expect(result).toEqual({ data: "value1" });
    });
  });

  describe("hit/miss tracking", () => {
    it("should track hits and misses", () => {
      cache.set("key1", { data: "value1" });
      
      cache.get("key1");
      cache.get("key1");
      cache.get("nonexistent");
      cache.get("nonexistent");

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
    });

    it("should calculate hit rate correctly", () => {
      cache.set("key1", { data: "value1" });
      
      cache.get("key1");
      cache.get("key1");
      cache.get("nonexistent");

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(0.666, 2);
    });

    it("should return 0 hit rate when no operations", () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it("should reset stats", () => {
      cache.set("key1", { data: "value1" });
      cache.get("key1");
      cache.get("nonexistent");

      cache.resetStats();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("LRU eviction", () => {
    it("should evict oldest entries when max is reached", () => {
      cache.set("key1", { data: "value1" });
      cache.set("key2", { data: "value2" });
      cache.set("key3", { data: "value3" });
      cache.set("key4", { data: "value4" });

      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toEqual({ data: "value2" });
      expect(cache.get("key3")).toEqual({ data: "value3" });
      expect(cache.get("key4")).toEqual({ data: "value4" });
    });

    it("should update recency on get", () => {
      cache.set("key1", { data: "value1" });
      cache.set("key2", { data: "value2" });
      cache.get("key1");
      cache.set("key3", { data: "value3" });

      expect(cache.get("key1")).toEqual({ data: "value1" });
      expect(cache.size).toBe(3);
    });
  });

  describe("TTL handling", () => {
    it("should expire entries after TTL", async () => {
      const shortCache = createLRUCache({
        max: 10,
        ttl: 50,
        name: "short-cache",
      });

      shortCache.set("key1", { data: "value1" });
      expect(shortCache.get("key1")).toEqual({ data: "value1" });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(shortCache.get("key1")).toBeUndefined();
    });
  });

  describe("complex data types", () => {
    it("should handle nested objects", () => {
      const complex = {
        user: {
          id: 1,
          name: "John",
          settings: {
            theme: "dark",
          },
        },
      };

      cache.set("complex", complex);
      const result = cache.get("complex");
      expect(result).toEqual(complex);
    });

    it("should handle arrays", () => {
      const data = {
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
      };

      cache.set("array", data);
      const result = cache.get("array");
      expect(result).toEqual(data);
    });
  });
});

describe("key-generator", () => {
  it("should generate consistent keys", () => {
    const { generateCacheKey } = require("../../src/lib/cache/key-generator");
    
    const key1 = generateCacheKey("query", { database: "test", limit: 10 });
    const key2 = generateCacheKey("query", { database: "test", limit: 10 });
    
    expect(key1).toBe(key2);
  });

  it("should generate different keys for different params", () => {
    const { generateCacheKey } = require("../../src/lib/cache/key-generator");
    
    const key1 = generateCacheKey("query", { database: "test", limit: 10 });
    const key2 = generateCacheKey("query", { database: "test", limit: 20 });
    
    expect(key1).not.toBe(key2);
  });

  it("should generate query cache keys", () => {
    const { generateQueryCacheKey } = require("../../src/lib/cache/key-generator");
    
    const key = generateQueryCacheKey("SELECT * FROM users", { database: "test", limit: 10 });
    
    expect(key).toContain("query:");
  });

  it("should generate schema cache keys", () => {
    const { generateSchemaCacheKey } = require("../../src/lib/cache/key-generator");
    
    const key = generateSchemaCacheKey("default", "users");
    
    expect(key).toBe("v1:schema:default:users");
  });
});
