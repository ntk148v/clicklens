import { describe, expect, test, beforeEach, jest } from "bun:test";
import {
  executeExactCount,
  clearExactCountCache,
  getExactCountCacheStats,
  getExactCountCacheSize,
  configureExactCountCache,
  executeApproximateCount,
  shouldUseExactCount,
  generateCacheKey,
  buildTableSource,
  COUNT_USAGE_GUIDE,
} from "../../src/lib/clickhouse/exact-count";
import type { ExactCountOptions } from "../../src/lib/clickhouse/exact-count";

const mockClient = {
  query: jest.fn(),
};

describe("exact-count", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearExactCountCache();
  });

  describe("generateCacheKey", () => {
    test("generates consistent cache key for same options", () => {
      const options1: ExactCountOptions = {
        database: "mydb",
        table: "logs",
        whereConditions: ["level = 'error'"],
      };
      const options2: ExactCountOptions = {
        database: "mydb",
        table: "logs",
        whereConditions: ["level = 'error'"],
      };
      expect(generateCacheKey(options1)).toBe(generateCacheKey(options2));
    });

    test("generates different key for different databases", () => {
      const options1: ExactCountOptions = { database: "db1", table: "logs" };
      const options2: ExactCountOptions = { database: "db2", table: "logs" };
      expect(generateCacheKey(options1)).not.toBe(generateCacheKey(options2));
    });

    test("generates different key for different tables", () => {
      const options1: ExactCountOptions = { database: "mydb", table: "logs" };
      const options2: ExactCountOptions = { database: "mydb", table: "events" };
      expect(generateCacheKey(options1)).not.toBe(generateCacheKey(options2));
    });

    test("generates different key for different where conditions", () => {
      const options1: ExactCountOptions = {
        database: "mydb",
        table: "logs",
        whereConditions: ["level = 'error'"],
      };
      const options2: ExactCountOptions = {
        database: "mydb",
        table: "logs",
        whereConditions: ["level = 'info'"],
      };
      expect(generateCacheKey(options1)).not.toBe(generateCacheKey(options2));
    });

    test("generates different key for distributed vs local", () => {
      const options1: ExactCountOptions = {
        database: "mydb",
        table: "logs",
        isDistributed: true,
      };
      const options2: ExactCountOptions = {
        database: "mydb",
        table: "logs",
        isDistributed: false,
      };
      expect(generateCacheKey(options1)).not.toBe(generateCacheKey(options2));
    });

    test("generates different key for different cluster names", () => {
      const options1: ExactCountOptions = {
        database: "mydb",
        table: "logs",
        clusterName: "cluster1",
      };
      const options2: ExactCountOptions = {
        database: "mydb",
        table: "logs",
        clusterName: "cluster2",
      };
      expect(generateCacheKey(options1)).not.toBe(generateCacheKey(options2));
    });
  });

  describe("buildTableSource", () => {
    test("builds simple table source", () => {
      const options: ExactCountOptions = { database: "mydb", table: "logs" };
      expect(buildTableSource(options)).toBe("`mydb`.`logs`");
    });

    test("builds clustered table source", () => {
      const options: ExactCountOptions = {
        database: "mydb",
        table: "logs",
        clusterName: "mycluster",
        isDistributed: false,
      };
      expect(buildTableSource(options)).toBe(
        "clusterAllReplicas('mycluster', `mydb`.`logs`)"
      );
    });

    test("does not use clusterAllReplicas for distributed tables", () => {
      const options: ExactCountOptions = {
        database: "mydb",
        table: "logs",
        clusterName: "mycluster",
        isDistributed: true,
      };
      expect(buildTableSource(options)).toBe("`mydb`.`logs`");
    });
  });

  describe("executeExactCount", () => {
    test("returns count from query result", async () => {
      mockClient.query.mockResolvedValue({
        data: [{ cnt: 12345 }],
      });

      const result = await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
      });

      expect(result.count).toBe(12345);
      expect(result.isExact).toBe(true);
      expect(result.cached).toBe(false);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    test("returns 0 when query returns no data", async () => {
      mockClient.query.mockResolvedValue({ data: [] });

      const result = await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
      });

      expect(result.count).toBe(0);
    });

    test("caches result on first call", async () => {
      mockClient.query.mockResolvedValue({ data: [{ cnt: 100 }] });

      await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
      });

      await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
      });

      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    test("returns cached result on second call", async () => {
      mockClient.query.mockResolvedValue({ data: [{ cnt: 100 }] });

      const result1 = await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
      });
      const result2 = await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
      });

      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(true);
      expect(result2.count).toBe(100);
    });

    test("bypasses cache when useCache is false", async () => {
      mockClient.query.mockResolvedValue({ data: [{ cnt: 100 }] });

      await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
      });
      await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
      });
      await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
      }, false);

      expect(mockClient.query).toHaveBeenCalledTimes(2);
    });

    test("applies WHERE conditions", async () => {
      mockClient.query.mockResolvedValue({ data: [{ cnt: 50 }] });

      await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
        whereConditions: ["level = 'error'"],
      });

      const query = mockClient.query.mock.calls[0][0];
      expect(query).toContain("WHERE");
      expect(query).toContain("level = 'error'");
    });
  });

  describe("executeApproximateCount", () => {
    test("uses system.parts for approximate count", async () => {
      mockClient.query.mockResolvedValue({ data: [{ cnt: 99999 }] });

      const result = await executeApproximateCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
      });

      expect(result.isExact).toBe(false);
      expect(result.count).toBe(99999);
      expect(mockClient.query.mock.calls[0][0]).toContain("system.parts");
    });
  });

  describe("shouldUseExactCount", () => {
    test("returns true when user explicitly requests exact", () => {
      expect(shouldUseExactCount(1_000_000, true)).toBe(true);
      expect(shouldUseExactCount(undefined, true)).toBe(true);
    });

    test("returns true for small tables without estimate", () => {
      expect(shouldUseExactCount(undefined, false)).toBe(true);
    });

    test("returns true for small tables (< 100K)", () => {
      expect(shouldUseExactCount(50_000, false)).toBe(true);
      expect(shouldUseExactCount(99_999, false)).toBe(true);
    });

    test("returns false for large tables (> 100K)", () => {
      expect(shouldUseExactCount(100_001, false)).toBe(false);
      expect(shouldUseExactCount(1_000_000, false)).toBe(false);
    });
  });

  describe("cache management", () => {
    test("clearExactCountCache clears cache", async () => {
      mockClient.query.mockResolvedValue({ data: [{ cnt: 100 }] });

      await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
      });
      expect(getExactCountCacheSize()).toBe(1);

      clearExactCountCache();
      expect(getExactCountCacheSize()).toBe(0);
    });

    test("getExactCountCacheStats returns stats", async () => {
      mockClient.query.mockResolvedValue({ data: [{ cnt: 100 }] });

      await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
      });
      await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "logs",
      });
      await executeExactCount(mockClient as unknown as { query: (sql: string) => Promise<unknown> }, {
        database: "mydb",
        table: "events",
      });

      const stats = getExactCountCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(0.333, 2);
    });

    test("configureExactCountCache allows custom config", () => {
      configureExactCountCache({ max: 100, ttl: 60_000 });
      clearExactCountCache();
    });
  });

  describe("COUNT_USAGE_GUIDE", () => {
    test("has exact count guidance", () => {
      expect(COUNT_USAGE_GUIDE.exact.useWhen).toBeInstanceOf(Array);
      expect(COUNT_USAGE_GUIDE.exact.advantages).toBeInstanceOf(Array);
      expect(COUNT_USAGE_GUIDE.exact.disadvantages).toBeInstanceOf(Array);
    });

    test("has approximate count guidance", () => {
      expect(COUNT_USAGE_GUIDE.approximate.useWhen).toBeInstanceOf(Array);
      expect(COUNT_USAGE_GUIDE.approximate.advantages).toBeInstanceOf(Array);
      expect(COUNT_USAGE_GUIDE.approximate.disadvantages).toBeInstanceOf(Array);
    });
  });
});
