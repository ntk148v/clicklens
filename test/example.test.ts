import { describe, it, expect, vi } from "bun:test";
import { createMockClickHouseClient, createMockQueryResult } from "./mocks/clickhouse";
import { createMockRedis } from "./mocks/redis";
import { createZustandStoreMock } from "./mocks/zustand";
import { createMockViewport, setupViewportMock, simulateScroll } from "./helpers/viewport";

describe("Test Infrastructure", () => {
  describe("ClickHouse Mock", () => {
    it("should create a mock client that returns empty results", async () => {
      const client = createMockClickHouseClient();
      const result = await client.query("SELECT 1");
      expect(result).toBeDefined();
      expect(result.data).toEqual([]);
    });

    it("should create mock query results with data", () => {
      const result = createMockQueryResult([{ id: 1 }, { id: 2 }], [
        { name: "id", type: "UInt32" },
      ]);
      expect(result.data).toHaveLength(2);
      expect(result.rows).toBe(2);
    });

    it("should simulate query failure", async () => {
      const client = createMockClickHouseClient({ shouldFail: true, errorMessage: "Query failed" });
      await expect(client.query("SELECT 1")).rejects.toThrow("Query failed");
    });
  });

  describe("Redis Mock", () => {
    it("should store and retrieve values", async () => {
      const redis = createMockRedis();
      await redis.set("key", "value");
      const result = await redis.get("key");
      expect(result).toBe("value");
    });

    it("should return null for non-existent keys", async () => {
      const redis = createMockRedis();
      const result = await redis.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should simulate Redis failure", async () => {
      const redis = createMockRedis({ shouldFail: true });
      await expect(redis.get("key")).rejects.toThrow("Redis connection failed");
    });
  });

  describe("Zustand Store Mock", () => {
    it("should get and set state", () => {
      const store = createZustandStoreMock({ count: 0 });
      expect(store.getState().count).toBe(0);
      store.setState({ count: 1 });
      expect(store.getState().count).toBe(1);
    });

    it("should notify subscribers on state changes", () => {
      const store = createZustandStoreMock({ count: 0 });
      const listener = vi.fn();
      store.subscribe(listener);
      store.setState({ count: 1 });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("Viewport Helper", () => {
    it("should create a mock viewport", () => {
      const viewport = createMockViewport({ width: 1920, height: 1080 });
      expect(viewport.width).toBe(1920);
      expect(viewport.height).toBe(1080);
    });

    it("should setup viewport mock on window", () => {
      const viewport = setupViewportMock({ width: 800, height: 600 });
      expect(window.innerWidth).toBe(800);
      expect(window.innerHeight).toBe(600);
    });

    it("should simulate scroll events", () => {
      setupViewportMock();
      simulateScroll(100);
      expect(window.scrollY).toBe(100);
    });
  });
});