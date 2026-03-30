import { describe, it, expect, beforeEach } from "bun:test";
import {
  generateCacheKey,
  generateCacheKeyWithVersion,
  generateQueryCacheKey,
  generateSchemaCacheKey,
  generateTableCacheKey,
  generatePattern,
  generateDatabasePrefix,
  generateTablePrefix,
  matchesPattern,
  getVersionedPrefix,
  extractVersion,
  isVersionCompatible,
  generateCompressedKey,
  clearKeyGeneratorCache,
  getCollisionStats,
  CACHE_KEY_VERSION,
  type QueryParams,
  type CacheKeyOptions,
} from "../../src/lib/cache/key-generator";

describe("key-generator enhanced", () => {
  beforeEach(() => {
    clearKeyGeneratorCache();
  });

  describe("generateCacheKey", () => {
    it("generates key with version prefix by default", () => {
      const params: QueryParams = { database: "test", table: "users" };
      const key = generateCacheKey("query", params);
      expect(key.startsWith("v1:")).toBe(true);
    });

    it("generates consistent keys for same input", () => {
      const params: QueryParams = { database: "test", table: "users" };
      const key1 = generateCacheKey("query", params);
      const key2 = generateCacheKey("query", params);
      expect(key1).toBe(key2);
    });

    it("generates different keys for different params", () => {
      const params1: QueryParams = { database: "test", table: "users" };
      const params2: QueryParams = { database: "test", table: "orders" };
      const key1 = generateCacheKey("query", params1);
      const key2 = generateCacheKey("query", params2);
      expect(key1).not.toBe(key2);
    });

    it("uses custom version when provided", () => {
      const params: QueryParams = { database: "test" };
      const options: CacheKeyOptions = { version: 2 };
      const key = generateCacheKey("query", params, options);
      expect(key.startsWith("v2:")).toBe(true);
    });

    it("sorts params by key name", () => {
      const params: QueryParams = { z: "zVal", a: "aVal", m: "mVal" };
      const key = generateCacheKey("test", params);
      expect(key).toContain("a:aVal");
      expect(key).toContain("m:mVal");
      expect(key).toContain("z:zVal");
    });

    it("handles undefined and null values", () => {
      const params: QueryParams = { a: undefined, b: null, c: "value" };
      const key = generateCacheKey("test", params);
      expect(key).toContain("c:value");
    });

    it("handles array values", () => {
      const params: QueryParams = { columns: ["c", "a", "b"] };
      const key = generateCacheKey("test", params);
      expect(key).toContain("columns:a,b,c");
    });

    it("handles object values with hashing", () => {
      const params: QueryParams = { filter: { field: "name", op: "eq" } as unknown as string };
      const key = generateCacheKey("test", params);
      expect(key).toContain("filter:");
    });

    it("applies memoization when enabled", () => {
      const params: QueryParams = { database: "test", table: "users" };
      const options: CacheKeyOptions = { memoize: true };
      generateCacheKey("query", params, options);
      const stats = getCollisionStats();
      expect(stats.cacheSize).toBeGreaterThan(0);
    });

    it("applies SHA-256 when enabled", () => {
      const params: QueryParams = { database: "test" };
      const options: CacheKeyOptions = { useSha256: true, memoize: true };
      const key = generateCacheKey("query", params, options);
      expect(key.length).toBeGreaterThan(32);
    });

    it("applies collision detection when enabled", () => {
      const params: QueryParams = { database: "test" };
      const options: CacheKeyOptions = { detectCollisions: true, memoize: true };
      generateCacheKey("query", params, options);
      const stats = getCollisionStats();
      expect(stats.totalKeys).toBeGreaterThan(0);
    });
  });

  describe("generateCacheKeyWithVersion", () => {
    it("generates key with explicit version", () => {
      const params: QueryParams = { database: "test" };
      const key1 = generateCacheKeyWithVersion("query", params, 5);
      const key2 = generateCacheKeyWithVersion("query", params, 1);
      expect(key1).not.toBe(key2);
    });

    it("enables memoization by default", () => {
      const params: QueryParams = { database: "test" };
      generateCacheKeyWithVersion("query", params);
      const stats = getCollisionStats();
      expect(stats.cacheSize).toBeGreaterThan(0);
    });
  });

  describe("generateQueryCacheKey", () => {
    it("generates key from query and params", () => {
      const params: QueryParams = { database: "test" };
      const key = generateQueryCacheKey("SELECT * FROM users", params);
      expect(key).toContain("query:");
      expect(key).toContain("database:test");
    });

    it("applies SHA-256 option", () => {
      const key = generateQueryCacheKey("SELECT 1", {}, { useSha256: true });
      expect(key.length).toBeGreaterThan(40);
    });

    it("handles empty params", () => {
      const key = generateQueryCacheKey("SELECT 1");
      expect(key).toContain("query:");
    });
  });

  describe("generateSchemaCacheKey", () => {
    it("generates key for database", () => {
      const key = generateSchemaCacheKey("testdb");
      expect(key).toContain("v1:schema:testdb");
    });

    it("generates key for database and table", () => {
      const key = generateSchemaCacheKey("testdb", "users");
      expect(key).toContain("v1:schema:testdb:users");
    });

    it("uses custom version", () => {
      const key = generateSchemaCacheKey("testdb", "users", 3);
      expect(key).toContain("v3:schema:testdb:users");
    });
  });

  describe("generateTableCacheKey", () => {
    it("generates key for database and table", () => {
      const key = generateTableCacheKey("testdb", "users");
      expect(key).toContain("v1:table:testdb:users");
    });

    it("includes viewType when provided", () => {
      const key = generateTableCacheKey("testdb", "users", "view");
      expect(key).toContain("v1:table:testdb:users:view");
    });

    it("uses custom version", () => {
      const key = generateTableCacheKey("testdb", "users", undefined, 4);
      expect(key).toContain("v4:table:testdb:users");
    });
  });

  describe("generatePattern", () => {
    it("generates pattern with database and table", () => {
      const pattern = generatePattern("query", "testdb", "users");
      expect(pattern).toBe("query:testdb:users:*");
    });

    it("generates pattern with database only", () => {
      const pattern = generatePattern("query", "testdb");
      expect(pattern).toBe("query:testdb:*");
    });
  });

  describe("generateDatabasePrefix", () => {
    it("generates prefix for database invalidation", () => {
      const prefix = generateDatabasePrefix("testdb");
      expect(prefix).toBe("query:testdb:*");
    });

    it("uses custom prefix", () => {
      const prefix = generateDatabasePrefix("testdb", "schema");
      expect(prefix).toBe("schema:testdb:*");
    });
  });

  describe("generateTablePrefix", () => {
    it("generates prefix for table invalidation", () => {
      const prefix = generateTablePrefix("testdb", "users");
      expect(prefix).toBe("query:testdb:users:*");
    });

    it("uses custom prefix", () => {
      const prefix = generateTablePrefix("testdb", "users", "schema");
      expect(prefix).toBe("schema:testdb:users:*");
    });
  });

  describe("matchesPattern", () => {
    it("matches exact key to pattern", () => {
      const key = "query:testdb:users:col1";
      const pattern = "query:testdb:users:*";
      expect(matchesPattern(key, pattern)).toBe(true);
    });

    it("matches database pattern", () => {
      const key = "query:testdb:orders:id:1";
      const pattern = "query:testdb:*";
      expect(matchesPattern(key, pattern)).toBe(true);
    });

    it("does not match non-matching pattern", () => {
      const key = "query:testdb:users:id:1";
      const pattern = "query:otherdb:*";
      expect(matchesPattern(key, pattern)).toBe(false);
    });

    it("handles wildcard in different positions", () => {
      expect(matchesPattern("v1:query:testdb", "v1:query:*")).toBe(true);
      expect(matchesPattern("v1:query:testdb:table", "v1:query:*:table")).toBe(true);
    });

    it("handles special regex characters in key", () => {
      const key = "query:test.db:users:col1";
      const pattern = "query:test.db:users:*";
      expect(matchesPattern(key, pattern)).toBe(true);
    });
  });

  describe("getVersionedPrefix", () => {
    it("generates versioned prefix", () => {
      const prefix = getVersionedPrefix("query", 2);
      expect(prefix).toBe("v2:query");
    });

    it("uses default version", () => {
      const prefix = getVersionedPrefix("query");
      expect(prefix).toBe("v1:query");
    });
  });

  describe("extractVersion", () => {
    it("extracts version from key", () => {
      const version = extractVersion("v2:query:testdb:users");
      expect(version).toBe(2);
    });

    it("returns null for key without version", () => {
      const version = extractVersion("query:testdb:users");
      expect(version).toBeNull();
    });

    it("handles version in different positions", () => {
      expect(extractVersion("v1:schema:testdb")).toBe(1);
      expect(extractVersion("v10:table:testdb")).toBe(10);
    });
  });

  describe("isVersionCompatible", () => {
    it("returns true for same version", () => {
      const compatible = isVersionCompatible(1, 1);
      expect(compatible).toBe(true);
    });

    it("returns false for older version", () => {
      const compatible = isVersionCompatible(1, 2);
      expect(compatible).toBe(false);
    });

    it("returns false for newer version", () => {
      const compatible = isVersionCompatible(3, 2);
      expect(compatible).toBe(false);
    });

    it("uses default current version", () => {
      const compatible = isVersionCompatible(1);
      expect(compatible).toBe(true);
    });
  });

  describe("generateCompressedKey", () => {
    it("returns normal key for short keys", () => {
      const params: QueryParams = { database: "test", table: "users" };
      const key = generateCompressedKey("query", params);
      expect(key).not.toContain("compressed:");
      expect(key).toContain("v1:query");
    });

    it("compresses long keys", () => {
      const longParams: QueryParams = {};
      for (let i = 0; i < 50; i++) {
        (longParams as Record<string, unknown>)[`field${i}`] = `value${i}_some_long_text_to_make_key_longer`;
      }
      const key = generateCompressedKey("query", longParams);
      expect(key).toContain("compressed:");
    });

    it("uses SHA-256 for compression when enabled", () => {
      const longParams: QueryParams = {};
      for (let i = 0; i < 50; i++) {
        (longParams as Record<string, unknown>)[`field${i}`] = `value${i}`;
      }
      const key = generateCompressedKey("query", longParams, { useSha256: true });
      expect(key).toContain("compressed:");
      expect(key.length).toBeGreaterThan(60);
    });
  });

  describe("CACHE_KEY_VERSION", () => {
    it("exports current version", () => {
      expect(CACHE_KEY_VERSION).toBe(1);
    });
  });

  describe("collision detection", () => {
    it("tracks key count", () => {
      const params: QueryParams = { database: "test" };
      generateCacheKey("query", params, { memoize: true, detectCollisions: true });
      const stats = getCollisionStats();
      expect(stats.totalKeys).toBe(1);
    });

    it("tracks cache size", () => {
      const params: QueryParams = { database: "test" };
      generateCacheKey("query", params, { memoize: true });
      const stats = getCollisionStats();
      expect(stats.cacheSize).toBeGreaterThanOrEqual(1);
    });

    it("clears stats on cache clear", () => {
      const params: QueryParams = { database: "test" };
      generateCacheKey("query", params, { memoize: true });
      clearKeyGeneratorCache();
      const stats = getCollisionStats();
      expect(stats.totalKeys).toBe(0);
      expect(stats.cacheSize).toBe(0);
    });
  });

  describe("backward compatibility", () => {
    it("works with no options (backward compatible)", () => {
      const params: QueryParams = { database: "test", table: "users" };
      const key = generateCacheKey("query", params);
      expect(key).toContain("v1:query");
      expect(key).toContain("database:test");
      expect(key).toContain("table:users");
    });

    it("works with empty params", () => {
      const key = generateCacheKey("query", {});
      expect(key).toContain("v1:query");
    });

    it("works with undefined params", () => {
      const key = generateCacheKey("query");
      expect(key).toContain("v1:query");
    });
  });

  describe("performance", () => {
    it("memoization improves performance on repeated keys", () => {
      const params: QueryParams = { database: "test", table: "users" };
      const options: CacheKeyOptions = { memoize: true };

      const startWithMemo = Date.now();
      for (let i = 0; i < 1000; i++) {
        generateCacheKey("query", params, options);
      }
      const timeWithMemo = Date.now() - startWithMemo;

      clearKeyGeneratorCache();

      const startWithoutMemo = Date.now();
      for (let i = 0; i < 1000; i++) {
        generateCacheKey("query", params, { memoize: false });
      }
      const timeWithoutMemo = Date.now() - startWithoutMemo;

      expect(timeWithMemo).toBeLessThanOrEqual(timeWithoutMemo);
    });
  });
});