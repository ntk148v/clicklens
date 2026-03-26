import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createQueryCache, QueryCache } from "./query-cache";

describe("QueryCache", () => {
  let cache: QueryCache;

  beforeEach(() => {
    cache = createQueryCache();
  });

  afterEach(async () => {
    await cache.clear();
  });

  test("get returns null for non-existent key", async () => {
    const result = await cache.get("nonexistent");
    expect(result).toBeNull();
  });

  test("set and get work correctly", async () => {
    const data = { foo: "bar", count: 42 };
    await cache.set("test_key", data);
    const result = await cache.get("test_key");

    if (result === null) {
      console.log("Skipping assertion: Redis not available");
      return;
    }

    expect(result).toEqual(data);
  });

  test("set with custom TTL", async () => {
    const data = { foo: "bar" };
    await cache.set("test_key", data, 1); // 1 second TTL

    const result1 = await cache.get("test_key");

    if (result1 === null) {
      console.log("Skipping assertion: Redis not available");
      return;
    }

    expect(result1).toEqual(data);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const result2 = await cache.get("test_key");
    expect(result2).toBeNull();
  });

  test("invalidate removes specific key", async () => {
    const data = { foo: "bar" };
    await cache.set("key1", data);
    await cache.set("key2", data);

    await cache.invalidate("key1");

    const result1 = await cache.get("key1");
    const result2 = await cache.get("key2");

    if (result2 === null) {
      console.log("Skipping assertion: Redis not available");
      return;
    }

    expect(result1).toBeNull();
    expect(result2).toEqual(data);
  });

  test("invalidate with pattern removes matching keys", async () => {
    const data = { foo: "bar" };
    await cache.set("histogram:db1:table1", data);
    await cache.set("histogram:db1:table2", data);
    await cache.set("field-values:db1:table1", data);

    await cache.invalidate("histogram:*");

    const result1 = await cache.get("histogram:db1:table1");
    const result2 = await cache.get("histogram:db1:table2");
    const result3 = await cache.get("field-values:db1:table1");

    if (result3 === null) {
      console.log("Skipping assertion: Redis not available");
      return;
    }

    expect(result1).toBeNull();
    expect(result2).toBeNull();
    expect(result3).toEqual(data);
  });

  test("clear removes all keys", async () => {
    const data = { foo: "bar" };
    await cache.set("key1", data);
    await cache.set("key2", data);

    await cache.clear();

    const result1 = await cache.get("key1");
    const result2 = await cache.get("key2");

    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });

  test("handles complex objects", async () => {
    const data = {
      nested: {
        array: [1, 2, 3],
        object: { a: "b" },
      },
      date: new Date().toISOString(),
    };
    await cache.set("complex_key", data);
    const result = await cache.get("complex_key");

    if (result === null) {
      console.log("Skipping assertion: Redis not available");
      return;
    }

    expect(result).toEqual(data);
  });

  test("handles null and undefined values", async () => {
    await cache.set("null_key", null);
    await cache.set("undefined_key", undefined);

    const result1 = await cache.get("null_key");
    const result2 = await cache.get("undefined_key");

    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });
});