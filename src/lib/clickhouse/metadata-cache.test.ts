import { describe, test, expect } from "bun:test";
import { MetadataCache } from "./metadata-cache";
import type { TableSchema } from "@/lib/types/discover";

describe("MetadataCache", () => {
  test("getOrFetch returns cached value", async () => {
    const cache = new MetadataCache();
    const mockSchema: TableSchema = {
      database: "test_db",
      table: "test_table",
      engine: "MergeTree",
      columns: [],
      timeColumns: [],
      orderByColumns: [],
      partitionKey: null,
    };

    let callCount = 0;
    const fetchFn = async () => {
      callCount++;
      return mockSchema;
    };

    const result1 = await cache.getOrFetch("test_key", fetchFn);
    const result2 = await cache.getOrFetch("test_key", fetchFn);

    expect(result1).toEqual(mockSchema);
    expect(result2).toEqual(mockSchema);
    expect(callCount).toBe(1);
  });

  test("getOrFetch calls fetchFn on cache miss", async () => {
    const cache = new MetadataCache();
    const mockSchema: TableSchema = {
      database: "test_db",
      table: "test_table",
      engine: "MergeTree",
      columns: [],
      timeColumns: [],
      orderByColumns: [],
      partitionKey: null,
    };

    let callCount = 0;
    const fetchFn = async () => {
      callCount++;
      return mockSchema;
    };

    await cache.getOrFetch("test_key", fetchFn);
    await cache.getOrFetch("test_key", fetchFn);

    expect(callCount).toBe(1);
  });

  test("invalidate removes entry from cache", async () => {
    const cache = new MetadataCache();
    const mockSchema: TableSchema = {
      database: "test_db",
      table: "test_table",
      engine: "MergeTree",
      columns: [],
      timeColumns: [],
      orderByColumns: [],
      partitionKey: null,
    };

    const fetchFn = async () => mockSchema;

    await cache.getOrFetch("test_key", fetchFn);
    cache.invalidate("test_key");

    let callCount = 0;
    const fetchFn2 = async () => {
      callCount++;
      return mockSchema;
    };

    await cache.getOrFetch("test_key", fetchFn2);

    expect(callCount).toBe(1);
  });

  test("clear removes all entries from cache", async () => {
    const cache = new MetadataCache();
    const mockSchema: TableSchema = {
      database: "test_db",
      table: "test_table",
      engine: "MergeTree",
      columns: [],
      timeColumns: [],
      orderByColumns: [],
      partitionKey: null,
    };

    const fetchFn = async () => mockSchema;

    await cache.getOrFetch("key1", fetchFn);
    await cache.getOrFetch("key2", fetchFn);
    cache.clear();

    let callCount = 0;
    const fetchFn2 = async () => {
      callCount++;
      return mockSchema;
    };

    await cache.getOrFetch("key1", fetchFn2);
    await cache.getOrFetch("key2", fetchFn2);

    expect(callCount).toBe(2);
  });

  test("LRU eviction removes least recently used entries", async () => {
    const cache = new MetadataCache({ max: 2 });
    const mockSchema: TableSchema = {
      database: "test_db",
      table: "test_table",
      engine: "MergeTree",
      columns: [],
      timeColumns: [],
      orderByColumns: [],
      partitionKey: null,
    };

    const fetchFn = async () => mockSchema;

    await cache.getOrFetch("key1", fetchFn);
    await cache.getOrFetch("key2", fetchFn);
    await cache.getOrFetch("key3", fetchFn);

    let callCount = 0;
    const fetchFn2 = async () => {
      callCount++;
      return mockSchema;
    };

    await cache.getOrFetch("key1", fetchFn2);

    expect(callCount).toBe(1);
  });

  test("TTL expiration removes expired entries", async () => {
    const cache = new MetadataCache({ ttl: 100 });
    const mockSchema: TableSchema = {
      database: "test_db",
      table: "test_table",
      engine: "MergeTree",
      columns: [],
      timeColumns: [],
      orderByColumns: [],
      partitionKey: null,
    };

    const fetchFn = async () => mockSchema;

    await cache.getOrFetch("test_key", fetchFn);

    await new Promise((resolve) => setTimeout(resolve, 150));

    let callCount = 0;
    const fetchFn2 = async () => {
      callCount++;
      return mockSchema;
    };

    await cache.getOrFetch("test_key", fetchFn2);

    expect(callCount).toBe(1);
  });

  test("concurrent access deduplicates fetch calls", async () => {
    const cache = new MetadataCache();
    const mockSchema: TableSchema = {
      database: "test_db",
      table: "test_table",
      engine: "MergeTree",
      columns: [],
      timeColumns: [],
      orderByColumns: [],
      partitionKey: null,
    };

    let callCount = 0;
    const fetchFn = async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return mockSchema;
    };

    const [result1, result2, result3] = await Promise.all([
      cache.getOrFetch("test_key", fetchFn),
      cache.getOrFetch("test_key", fetchFn),
      cache.getOrFetch("test_key", fetchFn),
    ]);

    expect(callCount).toBe(1);
    expect(result1).toEqual(mockSchema);
    expect(result2).toEqual(mockSchema);
    expect(result3).toEqual(mockSchema);
  });
});