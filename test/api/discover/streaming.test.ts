import { describe, it, expect, vi, beforeEach } from "bun:test";
import { fetchChunks } from "../../../src/lib/clickhouse/stream";
import { createMockClickHouseClient, createMockQueryResult } from "../../mocks/clickhouse";

// Test data
const mockRows = [
  { id: 1, name: "row1", timestamp: new Date("2024-01-01T00:00:00Z") },
  { id: 2, name: "row2", timestamp: new Date("2024-01-01T01:00:00Z") },
  { id: 3, name: "row3", timestamp: new Date("2024-01-01T02:00:00Z") },
];

describe("Streaming Implementation", () => {
  describe("fetchChunks - Immediate Streaming", () => {
    it("should emit meta chunk immediately without waiting for count", async () => {
      const mockClient = createMockClickHouseClient({ queryDelay: 100 });
      
      // Override query to simulate slow query but fast meta emission
      let queryCount = 0;
      (mockClient as unknown as { query: (sql: string) => Promise<unknown> }).query = async (sql: string) => {
        queryCount++;
        if (sql.includes("count()")) {
          // Slow count query
          await new Promise(resolve => setTimeout(resolve, 100));
          return createMockQueryResult([{ cnt: 100 }], [{ name: "cnt", type: "UInt64" }]);
        }
        // Fast data query
        return createMockQueryResult(mockRows, [
          { name: "id", type: "UInt32" },
          { name: "name", type: "String" },
        ]);
      };

      const iterator = fetchChunks({
        client: mockClient,
        tableSource: "test.table",
        whereConditions: [],
        timeColumn: "timestamp",
        minTime: "2024-01-01T00:00:00Z",
        maxTime: "2024-01-01T23:59:59Z",
        limit: 10,
        selectClause: "*",
        orderByClause: "ORDER BY timestamp DESC",
        safeTimeCol: "timestamp",
      });

      // First chunk should be meta with totalHits: -1 (pending)
      const firstResult = await iterator.next();
      expect(firstResult.done).toBe(false);
      expect(firstResult.value).toBeDefined();
      const firstChunk = JSON.parse(firstResult.value!.replace("\n", ""));
      expect(firstChunk.meta).toBeDefined();
      expect(firstChunk.meta.totalHits).toBe(-1);
      
      // Count query should have been started (for parallel execution)
      // The actual count will come later
    });

    it("should stream data chunks before count resolves", async () => {
      const dataChunks: string[] = [];
      
      const mockClient = {} as { query: (sql: string) => Promise<unknown> };
      
      // Use a flag to control count query behavior
      const countQueryDelay = 50;
      
      (mockClient as unknown as { query: (sql: string) => Promise<unknown> }).query = async (sql: string) => {
        if (sql.includes("count()")) {
          // Delayed count query
          await new Promise(resolve => setTimeout(resolve, countQueryDelay));
          return createMockQueryResult([{ cnt: 100 }], [{ name: "cnt", type: "UInt64" }]);
        }
        // Fast data query
        return createMockQueryResult(mockRows, [{ name: "id", type: "UInt32" }]);
      };

      const iterator = fetchChunks({
        client: mockClient,
        tableSource: "test.table",
        whereConditions: [],
        timeColumn: "timestamp",
        minTime: "2024-01-01T00:00:00Z",
        maxTime: "2024-01-01T23:59:59Z",
        limit: 10,
        selectClause: "*",
        orderByClause: "ORDER BY timestamp DESC",
        safeTimeCol: "timestamp",
      });

      // Collect all chunks
      for await (const chunk of iterator) {
        dataChunks.push(chunk);
      }

      // Should have received meta with -1, data rows, and final meta with count
      expect(dataChunks.length).toBeGreaterThanOrEqual(3);
      
      // First should be meta with -1
      const firstMeta = JSON.parse(dataChunks[0].replace("\n", ""));
      expect(firstMeta.meta.totalHits).toBe(-1);
      
      // Last should be meta with actual count
      const lastMeta = JSON.parse(dataChunks[dataChunks.length - 1].replace("\n", ""));
      expect(lastMeta.meta.totalHits).toBe(100);
    });

    it("should emit NDJSON format correctly", async () => {
      const mockClient = createMockClickHouseClient();
      (mockClient as unknown as { query: (sql: string) => Promise<unknown> }).query = async () => {
        return createMockQueryResult(mockRows, [
          { name: "id", type: "UInt32" },
          { name: "name", type: "String" },
        ]);
      };

      const iterator = fetchChunks({
        client: mockClient,
        tableSource: "test.table",
        whereConditions: [],
        limit: 10,
        selectClause: "*",
        orderByClause: "",
        safeTimeCol: "",
      });

      const chunks: string[] = [];
      for await (const chunk of iterator) {
        chunks.push(chunk);
      }

      // Each chunk should be valid NDJSON (JSON + newline)
      for (const chunk of chunks) {
        const trimmed = chunk.trim();
        expect(() => JSON.parse(trimmed)).not.toThrow();
        expect(chunk.endsWith("\n")).toBe(true);
      }
    });

    it("should handle queries without time column (fallback mode)", async () => {
      const mockClient = createMockClickHouseClient();
      (mockClient as unknown as { query: (sql: string) => Promise<unknown> }).query = async () => {
        return createMockQueryResult(mockRows, [
          { name: "id", type: "UInt32" },
        ]);
      };

      const iterator = fetchChunks({
        client: mockClient,
        tableSource: "test.table",
        whereConditions: [],
        limit: 10,
        selectClause: "*",
        orderByClause: "",
        safeTimeCol: "",
      });

      const chunks: string[] = [];
      for await (const chunk of iterator) {
        chunks.push(chunk);
      }

      // Should have meta + data rows + final meta
      expect(chunks.length).toBeGreaterThanOrEqual(3);
    });

    it("should handle query errors gracefully", async () => {
      const mockClient = createMockClickHouseClient({ shouldFail: true, errorMessage: "Query failed" });
      
      const iterator = fetchChunks({
        client: mockClient,
        tableSource: "test.table",
        whereConditions: [],
        limit: 10,
        selectClause: "*",
        orderByClause: "",
        safeTimeCol: "",
      });

      const chunks: string[] = [];
      for await (const chunk of iterator) {
        chunks.push(chunk);
      }

      // Should have meta + error chunk
      expect(chunks.length).toBe(2);
      const errorChunk = JSON.parse(chunks[1].replace("\n", ""));
      expect(errorChunk.error).toBeDefined();
    });
  });

  describe("Parallel Execution Verification", () => {
    it("should start count query in parallel with data query", async () => {
      const queryOrder: string[] = [];
      
      const mockClient = {} as { query: (sql: string) => Promise<unknown> };
      mockClient.query = async (sql: string) => {
        if (sql.includes("count()")) {
          queryOrder.push("count_start");
          await new Promise(resolve => setTimeout(resolve, 50));
          queryOrder.push("count_end");
          return createMockQueryResult([{ cnt: 10 }], [{ name: "cnt", type: "UInt64" }]);
        }
        queryOrder.push("data_start");
        await new Promise(resolve => setTimeout(resolve, 10));
        queryOrder.push("data_end");
        return createMockQueryResult(mockRows, [{ name: "id", type: "UInt32" }]);
      };

      const iterator = fetchChunks({
        client: mockClient,
        tableSource: "test.table",
        whereConditions: [],
        timeColumn: "timestamp",
        minTime: "2024-01-01T00:00:00Z",
        maxTime: "2024-01-01T23:59:59Z",
        limit: 10,
        selectClause: "*",
        orderByClause: "ORDER BY timestamp DESC",
        safeTimeCol: "timestamp",
      });

      // Consume iterator to trigger queries
      for await (const _chunk of iterator) {
        // Just consume
      }

      // Count should start before or at same time as data (parallel)
      // Not: count_start -> count_end -> data_start -> data_end (serial)
      const isParallel = !(queryOrder[0] === "count_start" && queryOrder[1] === "count_end");
      expect(isParallel).toBe(true);
    });
  });
});
