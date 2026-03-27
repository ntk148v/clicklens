import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { ClickHouseClient } from "./client";
import {
  executeApproxCount,
  type ApproxCountOptions,
  type ApproxCountResult,
} from "./approx-count";

const createMockClient = () => {
  return {
    query: async () => ({
      data: [],
      meta: [],
      rows: 0,
      statistics: {
        elapsed: 0,
        rows_read: 0,
        bytes_read: 0,
      },
    }),
  } as unknown as ClickHouseClient;
};

describe("executeApproxCount", () => {
  let mockClient: ClickHouseClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe("basic functionality", () => {
    it("should return approximate count with uniqCombined64 for large tables", async () => {
      let capturedQuery: string | undefined;
      (mockClient as any).query = async (query: string) => {
        capturedQuery = query;
        return { data: [{ cnt: "1000000" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "large_table",
        estimatedRows: 1_500_000,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.count).toBe(1000000);
      expect(result.isApproximate).toBe(true);
      expect(result.accuracy).toBe(0.97);
      expect(capturedQuery).toContain("uniqCombined64");
    });

    it("should use count() with SAMPLE for small tables (< 100K rows)", async () => {
      let capturedQuery: string | undefined;
      (mockClient as any).query = async (query: string) => {
        capturedQuery = query;
        return { data: [{ cnt: "50000" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "small_table",
        estimatedRows: 50_000,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.count).toBe(50000);
      expect(result.isApproximate).toBe(true);
      expect(result.accuracy).toBe(1.0);
      expect(capturedQuery).toContain("count()");
      expect(capturedQuery).toContain("SAMPLE");
    });

    it("should handle zero count", async () => {
      (mockClient as any).query = async () => {
        return { data: [{ cnt: "0" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "empty_table",
        estimatedRows: 0,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.count).toBe(0);
      expect(result.isApproximate).toBe(true);
    });
  });

  describe("WHERE conditions", () => {
    it("should apply WHERE conditions to the query", async () => {
      let capturedQuery: string | undefined;
      (mockClient as any).query = async (query: string) => {
        capturedQuery = query;
        return { data: [{ cnt: "100000" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "events",
        estimatedRows: 1_000_000,
        whereConditions: ['status = "active"', 'created_at > "2024-01-01"'],
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.count).toBe(100000);
      expect(capturedQuery).toContain('status = "active"');
      expect(capturedQuery).toContain('created_at > "2024-01-01"');
      expect(capturedQuery).toContain("WHERE");
    });

    it("should work without WHERE conditions", async () => {
      let capturedQuery: string | undefined;
      (mockClient as any).query = async (query: string) => {
        capturedQuery = query;
        return { data: [{ cnt: "500000" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "events",
        estimatedRows: 500_000,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.count).toBe(500000);
      expect(capturedQuery).not.toContain("WHERE");
    });
  });

  describe("distributed tables", () => {
    it("should use clusterAllReplicas for clustered non-distributed tables", async () => {
      let capturedQuery: string | undefined;
      (mockClient as any).query = async (query: string) => {
        capturedQuery = query;
        return { data: [{ cnt: "2000000" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "clustered_table",
        estimatedRows: 2_000_000,
        clusterName: "my_cluster",
        isDistributed: false,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.count).toBe(2000000);
      expect(capturedQuery).toContain("clusterAllReplicas");
      expect(capturedQuery).toContain("my_cluster");
    });

    it("should not use clusterAllReplicas for distributed tables", async () => {
      let capturedQuery: string | undefined;
      (mockClient as any).query = async (query: string) => {
        capturedQuery = query;
        return { data: [{ cnt: "3000000" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "distributed_table",
        estimatedRows: 3_000_000,
        clusterName: "my_cluster",
        isDistributed: true,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.count).toBe(3000000);
      expect(capturedQuery).not.toContain("clusterAllReplicas");
    });
  });

  describe("accuracy indicators", () => {
    it("should return 0.97 accuracy for uniqCombined64", async () => {
      (mockClient as any).query = async () => {
        return { data: [{ cnt: "1000000" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "large_table",
        estimatedRows: 1_500_000,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.accuracy).toBe(0.97);
    });

    it("should return 1.0 accuracy for small tables with SAMPLE", async () => {
      (mockClient as any).query = async () => {
        return { data: [{ cnt: "50000" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "small_table",
        estimatedRows: 50_000,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.accuracy).toBe(1.0);
    });
  });

  describe("error handling", () => {
    it("should throw error when query fails", async () => {
      (mockClient as any).query = async () => {
        throw new Error("Connection failed");
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "large_table",
        estimatedRows: 1_000_000,
      };

      await expect(executeApproxCount(mockClient, options)).rejects.toThrow(
        "Connection failed"
      );
    });

    it("should handle null/undefined data gracefully", async () => {
      (mockClient as any).query = async () => {
        return { data: [] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "large_table",
        estimatedRows: 1_000_000,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.count).toBe(0);
    });

    it("should handle invalid count values", async () => {
      (mockClient as any).query = async () => {
        return { data: [{ cnt: "invalid" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "large_table",
        estimatedRows: 1_000_000,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.count).toBe(0);
    });
  });

  describe("execution time tracking", () => {
    it("should track execution time", async () => {
      (mockClient as any).query = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { data: [{ cnt: "1000000" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "large_table",
        estimatedRows: 1_000_000,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.executionTime).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(10);
    });
  });

  describe("edge cases", () => {
    it("should handle very large counts", async () => {
      (mockClient as any).query = async () => {
        return { data: [{ cnt: "999999999999" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "huge_table",
        estimatedRows: 1_000_000_000_000,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.count).toBe(999999999999);
    });

    it("should handle boundary at 1M rows", async () => {
      (mockClient as any).query = async () => {
        return { data: [{ cnt: "1000000" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "boundary_table",
        estimatedRows: 1_000_000,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.count).toBe(1000000);
      expect(result.isApproximate).toBe(true);
    });

    it("should handle boundary at 100K rows", async () => {
      (mockClient as any).query = async () => {
        return { data: [{ cnt: "100000" }] };
      };

      const options: ApproxCountOptions = {
        database: "test_db",
        table: "boundary_table",
        estimatedRows: 100_000,
      };

      const result = await executeApproxCount(mockClient, options);

      expect(result.count).toBe(100000);
      expect(result.isApproximate).toBe(true);
    });
  });
});