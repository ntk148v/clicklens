import { describe, it, expect, beforeEach, vi } from "bun:test";
import { RedisCache } from "../../src/lib/cache/redis-cache";

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setEx: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  keys: vi.fn(),
  flushdb: vi.fn(),
  ping: vi.fn(),
};

vi.mock("../../src/lib/cache/redis-client", () => ({
  getRedisClient: vi.fn(() => Promise.resolve(mockRedis)),
  isRedisAvailable: vi.fn(() => true),
  closeRedisClient: vi.fn(),
}));

import { getRedisClient, isRedisAvailable } from "../../src/lib/cache/redis-client";

describe("RedisCache", () => {
  let cache: RedisCache;

  beforeEach(() => {
    vi.clearAllMocks();
    (isRedisAvailable as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getRedisClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockRedis);
    cache = new RedisCache({
      prefix: "test-cache",
      defaultTTL: 60,
      enableFallback: true,
    });
  });

  describe("basic operations", () => {
    it("should set and get values", async () => {
      const testData = { data: "test-value" };
      mockRedis.setEx.mockResolvedValue("OK");

      await cache.set("key1", testData);
      mockRedis.get.mockResolvedValue(JSON.stringify({ value: testData, timestamp: Date.now() }));

      const result = await cache.get("key1");
      expect(result).toEqual(testData);
    });

    it("should return undefined for non-existent keys", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get("nonexistent");
      expect(result).toBeUndefined();
    });

    it("should delete values", async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await cache.delete("key1");
      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith("test-cache:key1");
    });

    it("should return false when deleting non-existent key", async () => {
      mockRedis.del.mockResolvedValue(0);

      const result = await cache.delete("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle Redis errors gracefully", async () => {
      mockRedis.get.mockRejectedValue(new Error("Redis connection failed"));

      const result = await cache.get("key1");
      expect(result).toBeUndefined();
    });

    it("should fallback to memory when Redis unavailable", async () => {
      (isRedisAvailable as ReturnType<typeof vi.fn>).mockReturnValue(false);

      await cache.set("fallback-key", { data: "fallback-value" });

      const result = await cache.get("fallback-key");
      expect(result).toEqual({ data: "fallback-value" });
    });

    it("should handle set errors gracefully", async () => {
      mockRedis.setEx.mockRejectedValue(new Error("Redis error"));

      const result = await cache.set("key1", { data: "value" });
      expect(result).toBe(false);
    });

    it("should handle delete errors gracefully", async () => {
      mockRedis.del.mockRejectedValue(new Error("Redis error"));

      const result = await cache.delete("key1");
      expect(result).toBe(false);
    });
  });

  describe("TTL support", () => {
    it("should use custom TTL when provided", async () => {
      mockRedis.setEx.mockResolvedValue("OK");

      await cache.set("key1", { data: "value" }, 120);

      expect(mockRedis.setEx).toHaveBeenCalledWith(
        "test-cache:key1",
        120,
        expect.any(String),
      );
    });

    it("should use default TTL when not provided", async () => {
      mockRedis.setEx.mockResolvedValue("OK");

      await cache.set("key1", { data: "value" });

      expect(mockRedis.setEx).toHaveBeenCalledWith(
        "test-cache:key1",
        60,
        expect.any(String),
      );
    });

    it("should get TTL for a key", async () => {
      mockRedis.ttl.mockResolvedValue(30);

      const ttl = await cache.getTTL("key1");
      expect(ttl).toBe(30);
    });

    it("should set TTL for a key", async () => {
      mockRedis.expire.mockResolvedValue(1);

      const result = await cache.expire("key1", 60);
      expect(result).toBe(true);
    });
  });

  describe("cache metadata", () => {
    it("should check if key exists", async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await cache.has("key1");
      expect(result).toBe(true);
    });

    it("should return false for non-existent key", async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await cache.has("nonexistent");
      expect(result).toBe(false);
    });

    it("should get all keys", async () => {
      mockRedis.keys.mockResolvedValue(["test-cache:key1", "test-cache:key2"]);

      const keys = await cache.keys();
      expect(keys).toEqual(["key1", "key2"]);
    });

    it("should get cache size", async () => {
      mockRedis.keys.mockResolvedValue(["test-cache:key1", "test-cache:key2"]);

      const size = await cache.size();
      expect(size).toBe(2);
    });
  });

  describe("clear operation", () => {
    it("should clear all keys with prefix", async () => {
      mockRedis.keys.mockResolvedValue(["test-cache:key1", "test-cache:key2"]);
      mockRedis.del.mockResolvedValue(2);

      const result = await cache.clear();
      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it("should handle clear errors gracefully", async () => {
      mockRedis.keys.mockRejectedValue(new Error("Redis error"));

      const result = await cache.clear();
      expect(result).toBe(false);
    });
  });

  describe("fallback behavior", () => {
    it("should use fallback when Redis is down", async () => {
      (isRedisAvailable as ReturnType<typeof vi.fn>).mockReturnValue(false);

      await cache.set("fallback-key", { data: "fallback-data" });

      const result = await cache.get("fallback-key");
      expect(result).toEqual({ data: "fallback-data" });
    });

    it("should check fallback in has() when Redis unavailable", async () => {
      (isRedisAvailable as ReturnType<typeof vi.fn>).mockReturnValue(false);

      await cache.set("fallback-key", { data: "fallback-data" });

      const exists = await cache.has("fallback-key");
      expect(exists).toBe(true);
    });

    it("should return fallback keys when Redis unavailable", async () => {
      (isRedisAvailable as ReturnType<typeof vi.fn>).mockReturnValue(false);

      await cache.set("key1", { data: "value1" });
      await cache.set("key2", { data: "value2" });

      const keys = await cache.keys();
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
    });
  });
});