import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { LRUCacheImpl } from "../../src/lib/cache/lru-cache";
import {
  CacheInvalidator,
  createLRUInvalidator,
  createDatabaseDroppedEvent,
  createTableDroppedEvent,
  createTableAlteredEvent,
  createDataChangedEvent,
  createSchemaChangedEvent,
  type InvalidationEvent,
  type InvalidationResult,
} from "../../src/lib/cache/invalidation";

describe("CacheInvalidator", () => {
  let cache: LRUCacheImpl;
  let invalidator: CacheInvalidator;

  beforeEach(() => {
    cache = new LRUCacheImpl({ max: 100, ttl: 60000, name: "test-cache" });
    invalidator = createLRUInvalidator(cache, { enableLogging: false });
  });

  afterEach(() => {
    invalidator.destroy();
    cache.clear();
  });

  // ============================================================================
  // TTL-Based Invalidation Tests
  // ============================================================================

  describe("TTL-Based Invalidation", () => {
    test("setWithTTL stores value with expiration metadata", async () => {
      const result = await invalidator.setWithTTL("key1", { data: "value" }, 5000);
      expect(result).toBe(true);

      const value = await invalidator.getWithTTL("key1");
      expect(value).toEqual({ data: "value" });
    });

    test("getWithTTL returns undefined for expired keys", async () => {
      await invalidator.setWithTTL("expiring-key", { data: "value" }, 50);

      // Should exist immediately
      const value1 = await invalidator.getWithTTL("expiring-key");
      expect(value1).toEqual({ data: "value" });

      // Wait for expiration
      await new Promise((r) => setTimeout(r, 100));

      // Should be expired
      const value2 = await invalidator.getWithTTL("expiring-key");
      expect(value2).toBeUndefined();
    });

    test("getWithTTL returns undefined for non-existent keys", async () => {
      const value = await invalidator.getWithTTL("non-existent");
      expect(value).toBeUndefined();
    });

    test("getTTLStatus returns expiration info for valid keys", async () => {
      await invalidator.setWithTTL("ttl-key", { data: "value" }, 5000);

      const status = await invalidator.getTTLStatus("ttl-key");
      expect(status).toBeDefined();
      expect(status?.key).toBe("ttl-key");
      expect(status?.isExpired).toBe(false);
      expect(status?.remainingMs).toBeGreaterThan(0);
      expect(status?.remainingMs).toBeLessThanOrEqual(5000);
    });

    test("getTTLStatus returns undefined for non-existent keys", async () => {
      const status = await invalidator.getTTLStatus("non-existent");
      expect(status).toBeUndefined();
    });

    test("getTTLStatus returns isExpired=true for expired keys", async () => {
      await invalidator.setWithTTL("expired-key", { data: "value" }, 1);
      await new Promise((r) => setTimeout(r, 50));

      const status = await invalidator.getTTLStatus("expired-key");
      expect(status).toBeDefined();
      expect(status?.isExpired).toBe(true);
    });

    test("extendTTL extends expiration time", async () => {
      await invalidator.setWithTTL("extend-key", { data: "value" }, 100);

      const status1 = await invalidator.getTTLStatus("extend-key");
      const originalExpiry = status1!.expiresAt;

      // Extend TTL
      const extended = await invalidator.extendTTL("extend-key", 5000);
      expect(extended).toBe(true);

      const status2 = await invalidator.getTTLStatus("extend-key");
      expect(status2!.expiresAt).toBeGreaterThan(originalExpiry);
    });

    test("extendTTL returns false for non-existent keys", async () => {
      const result = await invalidator.extendTTL("non-existent", 5000);
      expect(result).toBe(false);
    });

    test("setWithTTL handles complex objects", async () => {
      const complexData = {
        nested: { array: [1, 2, 3], obj: { a: "b" } },
        date: new Date().toISOString(),
        nullValue: null,
      };

      await invalidator.setWithTTL("complex-key", complexData, 5000);
      const value = await invalidator.getWithTTL("complex-key");
      expect(value).toEqual(complexData);
    });
  });

  // ============================================================================
  // Manual Invalidation Tests
  // ============================================================================

  describe("Manual Invalidation", () => {
    test("invalidate removes specific key", async () => {
      cache.set("key1", { data: "value1" });
      cache.set("key2", { data: "value2" });

      const result = await invalidator.invalidate("key1");
      expect(result).toBe(true);

      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(true);
    });

    test("invalidate returns false for non-existent key", async () => {
      const result = await invalidator.invalidate("non-existent");
      expect(result).toBe(false);
    });

    test("invalidateMany removes multiple keys", async () => {
      cache.set("key1", { data: "value1" });
      cache.set("key2", { data: "value2" });
      cache.set("key3", { data: "value3" });

      const result = await invalidator.invalidateMany(["key1", "key2", "non-existent"]);

      expect(result.success).toBe(true);
      expect(result.keysInvalidated).toContain("key1");
      expect(result.keysInvalidated).toContain("key2");
      expect(result.keysNotFound).toContain("non-existent");
      expect(result.errors).toHaveLength(0);

      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
      expect(cache.has("key3")).toBe(true);
    });

    test("invalidateMany handles empty array", async () => {
      const result = await invalidator.invalidateMany([]);
      expect(result.success).toBe(true);
      expect(result.keysInvalidated).toHaveLength(0);
    });

    test("clearAll removes all entries", async () => {
      cache.set("key1", { data: "value1" });
      cache.set("key2", { data: "value2" });

      const result = await invalidator.clearAll();
      expect(result).toBe(true);

      expect(cache.size).toBe(0);
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
    });

    test("clearAll handles empty cache", async () => {
      const result = await invalidator.clearAll();
      expect(result).toBe(true);
      expect(cache.size).toBe(0);
    });
  });

  // ============================================================================
  // Event-Based Invalidation Tests
  // ============================================================================

  describe("Event-Based Invalidation", () => {
    test("onEvent registers and calls event handler", async () => {
      const events: InvalidationEvent[] = [];
      const unsubscribe = invalidator.onEvent("table-dropped", (event) => {
        events.push(event);
      });

      const event = createTableDroppedEvent("db1", "table1");
      await invalidator.emitEvent(event);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("table-dropped");
      expect(events[0].database).toBe("db1");
      expect(events[0].table).toBe("table1");

      unsubscribe();
    });

    test("onEvent unsubscribe removes handler", async () => {
      const events: InvalidationEvent[] = [];
      const unsubscribe = invalidator.onEvent("table-dropped", (event) => {
        events.push(event);
      });

      unsubscribe();

      const event = createTableDroppedEvent("db1", "table1");
      await invalidator.emitEvent(event);

      expect(events).toHaveLength(0);
    });

    test("multiple handlers can be registered for same event", async () => {
      const events1: InvalidationEvent[] = [];
      const events2: InvalidationEvent[] = [];

      invalidator.onEvent("table-dropped", (event) => events1.push(event));
      invalidator.onEvent("table-dropped", (event) => events2.push(event));

      const event = createTableDroppedEvent("db1", "table1");
      await invalidator.emitEvent(event);

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
    });

    test("database-dropped event invalidates database cache", async () => {
      cache.set("query:db1:table1:data", { data: "value1" });
      cache.set("query:db1:table2:data", { data: "value2" });
      cache.set("query:db2:table1:data", { data: "value3" });

      const event = createDatabaseDroppedEvent("db1");
      await invalidator.emitEvent(event);

      expect(cache.has("query:db1:table1:data")).toBe(false);
      expect(cache.has("query:db1:table2:data")).toBe(false);
      expect(cache.has("query:db2:table1:data")).toBe(true);
    });

    test("table-dropped event invalidates table cache", async () => {
      cache.set("query:db1:table1:data1", { data: "value1" });
      cache.set("query:db1:table1:data2", { data: "value2" });
      cache.set("query:db1:table2:data", { data: "value3" });

      const event = createTableDroppedEvent("db1", "table1");
      await invalidator.emitEvent(event);

      expect(cache.has("query:db1:table1:data1")).toBe(false);
      expect(cache.has("query:db1:table1:data2")).toBe(false);
      expect(cache.has("query:db1:table2:data")).toBe(true);
    });

    test("table-altered event invalidates table cache", async () => {
      cache.set("query:db1:table1:data", { data: "value" });

      const event = createTableAlteredEvent("db1", "table1");
      await invalidator.emitEvent(event);

      expect(cache.has("query:db1:table1:data")).toBe(false);
    });

    test("data-inserted event invalidates table cache", async () => {
      cache.set("query:db1:table1:data", { data: "value" });

      const event = createDataChangedEvent("data-inserted", "db1", "table1");
      await invalidator.emitEvent(event);

      expect(cache.has("query:db1:table1:data")).toBe(false);
    });

    test("data-updated event invalidates table cache", async () => {
      cache.set("query:db1:table1:data", { data: "value" });

      const event = createDataChangedEvent("data-updated", "db1", "table1");
      await invalidator.emitEvent(event);

      expect(cache.has("query:db1:table1:data")).toBe(false);
    });

    test("data-deleted event invalidates table cache", async () => {
      cache.set("query:db1:table1:data", { data: "value" });

      const event = createDataChangedEvent("data-deleted", "db1", "table1");
      await invalidator.emitEvent(event);

      expect(cache.has("query:db1:table1:data")).toBe(false);
    });

    test("schema-changed event invalidates schema cache", async () => {
      cache.set("v1:schema:db1:table1", { data: "value1" });
      cache.set("v1:schema:db1", { data: "value2" });
      cache.set("query:db1:table1:data", { data: "value3" });

      const event = createSchemaChangedEvent();
      await invalidator.emitEvent(event);

      expect(cache.has("v1:schema:db1:table1")).toBe(false);
      expect(cache.has("v1:schema:db1")).toBe(false);
      expect(cache.has("query:db1:table1:data")).toBe(true);
    });

    test("emitEventDebounced batches multiple events", async () => {
      const events: InvalidationEvent[] = [];
      invalidator.onEvent("data-inserted", (event) => events.push(event));

      // Emit multiple events rapidly
      invalidator.emitEventDebounced(
        createDataChangedEvent("data-inserted", "db1", "table1"),
        50
      );
      invalidator.emitEventDebounced(
        createDataChangedEvent("data-inserted", "db1", "table1"),
        50
      );
      invalidator.emitEventDebounced(
        createDataChangedEvent("data-inserted", "db1", "table1"),
        50
      );

      // Wait for debounce
      await new Promise((r) => setTimeout(r, 100));

      // Should only have one consolidated event
      expect(events).toHaveLength(1);
      expect(events[0].metadata?.batchSize).toBe(3);
    });

    test("cache-cleared event clears all cache", async () => {
      cache.set("key1", { data: "value1" });
      cache.set("key2", { data: "value2" });

      const event: InvalidationEvent = {
        type: "cache-cleared",
        timestamp: Date.now(),
      };
      await invalidator.emitEvent(event);

      expect(cache.size).toBe(0);
    });
  });

  // ============================================================================
  // Partial Invalidation Tests
  // ============================================================================

  describe("Partial Invalidation", () => {
    beforeEach(() => {
      // Set up cache with various keys
      cache.set("query:db1:table1:data1", { data: "value1" });
      cache.set("query:db1:table1:data2", { data: "value2" });
      cache.set("query:db1:table2:data", { data: "value3" });
      cache.set("query:db2:table1:data", { data: "value4" });
      cache.set("histogram:db1:table1", { data: "value5" });
      cache.set("schema:db1:table1", { data: "value6" });
    });

    test("invalidateByPattern removes matching keys", async () => {
      const result = await invalidator.invalidateByPattern("query:db1:table1:*");

      expect(result.success).toBe(true);
      expect(result.keysInvalidated).toContain("query:db1:table1:data1");
      expect(result.keysInvalidated).toContain("query:db1:table1:data2");
      expect(result.keysInvalidated).not.toContain("query:db1:table2:data");

      expect(cache.has("query:db1:table1:data1")).toBe(false);
      expect(cache.has("query:db1:table1:data2")).toBe(false);
      expect(cache.has("query:db1:table2:data")).toBe(true);
    });

    test("invalidateByPattern with * wildcard matches all", async () => {
      const result = await invalidator.invalidateByPattern("query:*");

      expect(result.keysInvalidated.length).toBe(4);
      expect(cache.has("query:db1:table1:data1")).toBe(false);
      expect(cache.has("histogram:db1:table1")).toBe(true);
    });

    test("invalidateByPattern returns empty result for non-matching pattern", async () => {
      const result = await invalidator.invalidateByPattern("nonexistent:*");

      expect(result.success).toBe(true);
      expect(result.keysInvalidated).toHaveLength(0);
    });

    test("invalidateByDatabase removes all keys for database", async () => {
      const result = await invalidator.invalidateByDatabase("db1");

      expect(result.success).toBe(true);
      expect(result.keysInvalidated.length).toBeGreaterThan(0);
      expect(cache.has("query:db1:table1:data1")).toBe(false);
      expect(cache.has("query:db2:table1:data")).toBe(true);
    });

    test("invalidateByTable removes all keys for table", async () => {
      const result = await invalidator.invalidateByTable("db1", "table1");

      expect(result.success).toBe(true);
      expect(result.keysInvalidated.length).toBeGreaterThan(0);
      expect(cache.has("query:db1:table1:data1")).toBe(false);
      expect(cache.has("query:db1:table2:data")).toBe(true);
    });

    test("invalidateByPrefix removes keys with prefix", async () => {
      const result = await invalidator.invalidateByPrefix("histogram:");

      expect(result.success).toBe(true);
      expect(result.keysInvalidated).toContain("histogram:db1:table1");
      expect(cache.has("histogram:db1:table1")).toBe(false);
      expect(cache.has("query:db1:table1:data1")).toBe(true);
    });

    test("invalidateByTags returns error (not implemented)", async () => {
      const result = await invalidator.invalidateByTags(["tag1", "tag2"]);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Utility Method Tests
  // ============================================================================

  describe("Utility Methods", () => {
    test("getAllKeys returns all cache keys", async () => {
      cache.set("key1", { data: "value1" });
      cache.set("key2", { data: "value2" });
      cache.set("key3", { data: "value3" });

      const keys = await invalidator.getAllKeys();

      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
      expect(keys).toHaveLength(3);
    });

    test("getAllKeys returns empty array for empty cache", async () => {
      const keys = await invalidator.getAllKeys();
      expect(keys).toHaveLength(0);
    });

    test("has returns true for existing key", async () => {
      cache.set("existing-key", { data: "value" });

      const result = await invalidator.has("existing-key");
      expect(result).toBe(true);
    });

    test("has returns false for non-existent key", async () => {
      const result = await invalidator.has("non-existent");
      expect(result).toBe(false);
    });

    test("destroy cleans up resources", async () => {
      // Set up some state
      invalidator.onEvent("table-dropped", () => {});
      invalidator.emitEventDebounced(createTableDroppedEvent("db1", "table1"), 1000);

      // Destroy
      invalidator.destroy();

      // Should be able to create new invalidator without issues
      const newInvalidator = createLRUInvalidator(cache);
      expect(newInvalidator).toBeDefined();
      newInvalidator.destroy();
    });
  });

  // ============================================================================
  // Callback and Event Tests
  // ============================================================================

  describe("Callbacks and Events", () => {
    test("onInvalidate callback is called on manual invalidation", async () => {
      const invalidatedKeys: Array<{ key: string; reason: string }> = [];
      const callbackInvalidator = createLRUInvalidator(cache, {
        enableLogging: false,
        onInvalidate: (key, reason) => {
          invalidatedKeys.push({ key, reason });
        },
      });

      cache.set("key1", { data: "value" });
      await callbackInvalidator.invalidate("key1");

      expect(invalidatedKeys).toHaveLength(1);
      expect(invalidatedKeys[0].key).toBe("key1");
      expect(invalidatedKeys[0].reason).toBe("manual");

      callbackInvalidator.destroy();
    });

    test("onInvalidate callback is called on TTL expiration", async () => {
      const invalidatedKeys: Array<{ key: string; reason: string }> = [];
      const callbackInvalidator = createLRUInvalidator(cache, {
        enableLogging: false,
        onInvalidate: (key, reason) => {
          invalidatedKeys.push({ key, reason });
        },
      });

      await callbackInvalidator.setWithTTL("expiring-key", { data: "value" }, 1);
      await new Promise((r) => setTimeout(r, 50));

      // Access to trigger expiration check
      await callbackInvalidator.getWithTTL("expiring-key");

      expect(invalidatedKeys).toHaveLength(1);
      expect(invalidatedKeys[0].key).toBe("expiring-key");
      expect(invalidatedKeys[0].reason).toBe("ttl-expired");

      callbackInvalidator.destroy();
    });

    test("onInvalidate callback is called on pattern invalidation", async () => {
      const invalidatedKeys: Array<{ key: string; reason: string }> = [];
      const callbackInvalidator = createLRUInvalidator(cache, {
        enableLogging: false,
        onInvalidate: (key, reason) => {
          invalidatedKeys.push({ key, reason });
        },
      });

      cache.set("query:db1:table1:data", { data: "value" });
      await callbackInvalidator.invalidateByPattern("query:db1:*");

      expect(invalidatedKeys.length).toBeGreaterThan(0);
      expect(invalidatedKeys[0].reason).toBe("pattern-match");

      callbackInvalidator.destroy();
    });

    test("onInvalidate callback is called on database invalidation", async () => {
      const invalidatedKeys: Array<{ key: string; reason: string }> = [];
      const callbackInvalidator = createLRUInvalidator(cache, {
        enableLogging: false,
        onInvalidate: (key, reason) => {
          invalidatedKeys.push({ key, reason });
        },
      });

      cache.set("query:db1:table1:data", { data: "value" });
      await callbackInvalidator.invalidateByDatabase("db1");

      expect(invalidatedKeys.length).toBeGreaterThan(0);
      expect(invalidatedKeys[0].reason).toBe("database-change");

      callbackInvalidator.destroy();
    });

    test("onInvalidate callback is called on table invalidation", async () => {
      const invalidatedKeys: Array<{ key: string; reason: string }> = [];
      const callbackInvalidator = createLRUInvalidator(cache, {
        enableLogging: false,
        onInvalidate: (key, reason) => {
          invalidatedKeys.push({ key, reason });
        },
      });

      cache.set("query:db1:table1:data", { data: "value" });
      await callbackInvalidator.invalidateByTable("db1", "table1");

      expect(invalidatedKeys.length).toBeGreaterThan(0);
      expect(invalidatedKeys[0].reason).toBe("table-change");

      callbackInvalidator.destroy();
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe("Edge Cases and Error Handling", () => {
    test("handles invalid keys gracefully", async () => {
      const result = await invalidator.invalidate("");
      expect(result).toBe(false);
    });

    test("handles special characters in keys", async () => {
      const specialKey = "key:with:special:chars:123-abc";
      await invalidator.setWithTTL(specialKey, { data: "value" }, 5000);

      const value = await invalidator.getWithTTL(specialKey);
      expect(value).toEqual({ data: "value" });

      const result = await invalidator.invalidate(specialKey);
      expect(result).toBe(true);
    });

    test("handles very long keys", async () => {
      const longKey = "a".repeat(500);
      await invalidator.setWithTTL(longKey, { data: "value" }, 5000);

      const value = await invalidator.getWithTTL(longKey);
      expect(value).toEqual({ data: "value" });
    });

    test("handles concurrent invalidations", async () => {
      cache.set("key1", { data: "value1" });
      cache.set("key2", { data: "value2" });
      cache.set("key3", { data: "value3" });

      const results = await Promise.all([
        invalidator.invalidate("key1"),
        invalidator.invalidate("key2"),
        invalidator.invalidate("key3"),
      ]);

      expect(results).toEqual([true, true, true]);
      expect(cache.size).toBe(0);
    });

    test("handles empty pattern", async () => {
      const result = await invalidator.invalidateByPattern("");
      expect(result.success).toBe(true);
      expect(result.keysInvalidated).toHaveLength(0);
    });

    test("handles pattern matching all keys", async () => {
      cache.set("key1", { data: "value1" });
      cache.set("key2", { data: "value2" });

      const result = await invalidator.invalidateByPattern("*");

      expect(result.success).toBe(true);
      expect(result.keysInvalidated.length).toBe(2);
      expect(cache.size).toBe(0);
    });

    test("handles null and undefined values in TTL entries", async () => {
      await invalidator.setWithTTL("null-key", null, 5000);
      await invalidator.setWithTTL("undefined-key", undefined, 5000);

      const nullValue = await invalidator.getWithTTL("null-key");
      const undefinedValue = await invalidator.getWithTTL("undefined-key");

      expect(nullValue).toBeNull();
      expect(undefinedValue).toBeUndefined();
    });

    test("handles rapid TTL checks without race conditions", async () => {
      await invalidator.setWithTTL("rapid-key", { data: "value" }, 1000);

      const checks = await Promise.all([
        invalidator.getWithTTL("rapid-key"),
        invalidator.getWithTTL("rapid-key"),
        invalidator.getWithTTL("rapid-key"),
      ]);

      expect(checks.every((v) => v !== undefined)).toBe(true);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("Integration Tests", () => {
    test("full workflow: set, get, extend, expire", async () => {
      // Set with TTL
      await invalidator.setWithTTL("workflow-key", { stage: 1 }, 100);

      // Get should work
      let value = await invalidator.getWithTTL("workflow-key");
      expect(value).toEqual({ stage: 1 });

      // Extend TTL
      await invalidator.extendTTL("workflow-key", 5000);

      // Wait for original TTL
      await new Promise((r) => setTimeout(r, 150));

      // Should still exist due to extension
      value = await invalidator.getWithTTL("workflow-key");
      expect(value).toEqual({ stage: 1 });

      // Invalidate manually
      await invalidator.invalidate("workflow-key");

      // Should be gone
      value = await invalidator.getWithTTL("workflow-key");
      expect(value).toBeUndefined();
    });

    test("event-driven invalidation workflow", async () => {
      // Set up cache with database data
      cache.set("query:mydb:users:data1", { users: [1, 2, 3] });
      cache.set("query:mydb:users:data2", { users: [4, 5, 6] });
      cache.set("query:mydb:orders:data", { orders: [1, 2] });
      cache.set("query:otherdb:table:data", { data: "value" });

      // Simulate table drop event
      const event = createTableDroppedEvent("mydb", "users");
      await invalidator.emitEvent(event);

      // Only users table data should be invalidated
      expect(cache.has("query:mydb:users:data1")).toBe(false);
      expect(cache.has("query:mydb:users:data2")).toBe(false);
      expect(cache.has("query:mydb:orders:data")).toBe(true);
      expect(cache.has("query:otherdb:table:data")).toBe(true);
    });

    test("bulk operations with partial invalidation", async () => {
      // Populate cache
      for (let i = 0; i < 10; i++) {
        cache.set(`query:db1:table1:data${i}`, { index: i });
        cache.set(`query:db1:table2:data${i}`, { index: i });
        cache.set(`query:db2:table1:data${i}`, { index: i });
      }

      expect(cache.size).toBe(30);

      // Invalidate only table1 in db1
      const result = await invalidator.invalidateByTable("db1", "table1");

      expect(result.keysInvalidated.length).toBe(10);
      expect(cache.size).toBe(20);

      // Verify correct keys remain
      for (let i = 0; i < 10; i++) {
        expect(cache.has(`query:db1:table1:data${i}`)).toBe(false);
        expect(cache.has(`query:db1:table2:data${i}`)).toBe(true);
        expect(cache.has(`query:db2:table1:data${i}`)).toBe(true);
      }
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe("Factory Functions", () => {
  test("createLRUInvalidator creates valid invalidator", () => {
    const cache = new LRUCacheImpl({ max: 100 });
    const invalidator = createLRUInvalidator(cache);

    expect(invalidator).toBeInstanceOf(CacheInvalidator);
    invalidator.destroy();
  });
});

// ============================================================================
// Event Helper Tests
// ============================================================================

describe("Event Helpers", () => {
  test("createDatabaseDroppedEvent creates correct event", () => {
    const event = createDatabaseDroppedEvent("testdb", { reason: "cleanup" });

    expect(event.type).toBe("database-dropped");
    expect(event.database).toBe("testdb");
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.metadata).toEqual({ reason: "cleanup" });
  });

  test("createTableDroppedEvent creates correct event", () => {
    const event = createTableDroppedEvent("testdb", "testtable");

    expect(event.type).toBe("table-dropped");
    expect(event.database).toBe("testdb");
    expect(event.table).toBe("testtable");
    expect(event.timestamp).toBeGreaterThan(0);
  });

  test("createTableAlteredEvent creates correct event", () => {
    const event = createTableAlteredEvent("testdb", "testtable", {
      alterType: "ADD COLUMN",
    });

    expect(event.type).toBe("table-altered");
    expect(event.database).toBe("testdb");
    expect(event.table).toBe("testtable");
    expect(event.metadata).toEqual({ alterType: "ADD COLUMN" });
  });

  test("createDataChangedEvent creates correct events for all types", () => {
    const insertEvent = createDataChangedEvent("data-inserted", "db", "table");
    expect(insertEvent.type).toBe("data-inserted");

    const updateEvent = createDataChangedEvent("data-updated", "db", "table");
    expect(updateEvent.type).toBe("data-updated");

    const deleteEvent = createDataChangedEvent("data-deleted", "db", "table");
    expect(deleteEvent.type).toBe("data-deleted");
  });

  test("createSchemaChangedEvent creates correct event", () => {
    const event = createSchemaChangedEvent({ version: "2.0" });

    expect(event.type).toBe("schema-changed");
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.metadata).toEqual({ version: "2.0" });
  });
});
