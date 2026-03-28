import { describe, it, expect } from "bun:test";
import { fetchChunks } from "../../../src/lib/clickhouse/stream";
import { createMockClickHouseClient, createMockQueryResult } from "../../mocks/clickhouse";

const mockRows = [
  { id: 1, name: "row1" },
  { id: 2, name: "row2" },
  { id: 3, name: "row3" },
];

describe("Count Query Execution", () => {
  it("should run count query in parallel with data", async () => {
    const executionTimes: { query: string; start: number; end: number }[] = [];
    
    const mockClient = {} as { query: (sql: string) => Promise<unknown> };
    mockClient.query = async (sql: string) => {
      const queryType = sql.includes("count()") ? "count" : "data";
      const start = Date.now();
      
      if (queryType === "count") {
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      executionTimes.push({
        query: queryType,
        start,
        end: Date.now(),
      });
      
      if (queryType === "count") {
        return createMockQueryResult([{ cnt: 100 }], [{ name: "cnt", type: "UInt64" }]);
      }
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

    for await (const _chunk of iterator) {
      // consume
    }

    const countQuery = executionTimes.find(e => e.query === "count");
    const dataQuery = executionTimes.find(e => e.query === "data");
    
    expect(countQuery).toBeDefined();
    expect(dataQuery).toBeDefined();
    
    // Count starts before or at same time as data (parallel)
    expect(countQuery!.start).toBeLessThanOrEqual(dataQuery!.start + 10);
  });

  it("should return -1 initially then update with actual count", async () => {
    const mockClient = createMockClickHouseClient({ queryDelay: 50 });
    (mockClient as unknown as { query: (sql: string) => Promise<unknown> }).query = async (sql: string) => {
      if (sql.includes("count()")) {
        await new Promise(resolve => setTimeout(resolve, 50));
        return createMockQueryResult([{ cnt: 42 }], [{ name: "cnt", type: "UInt64" }]);
      }
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

    const firstResult = await iterator.next();
    const firstChunk = JSON.parse(firstResult.value!.replace("\n", ""));
    expect(firstChunk.meta.totalHits).toBe(-1);

    const allChunks: string[] = [];
    for await (const chunk of iterator) {
      allChunks.push(chunk);
    }

    const lastChunk = JSON.parse(allChunks[allChunks.length - 1].replace("\n", ""));
    expect(lastChunk.meta.totalHits).toBe(42);
  });

  it("should handle count query failure gracefully", async () => {
    let shouldFailCount = true;
    const mockClient = {} as { query: (sql: string) => Promise<unknown> };
    mockClient.query = async (sql: string) => {
      if (sql.includes("count()")) {
        if (shouldFailCount) {
          shouldFailCount = false;
          throw new Error("Count failed");
        }
        return createMockQueryResult([{ cnt: 0 }], [{ name: "cnt", type: "UInt64" }]);
      }
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

    const allChunks: string[] = [];
    for await (const chunk of iterator) {
      allChunks.push(chunk);
    }

    // Should still get data, and final meta should have count 0 from failed query
    expect(allChunks.length).toBeGreaterThan(2);
    const lastChunk = JSON.parse(allChunks[allChunks.length - 1].replace("\n", ""));
    expect(lastChunk.meta.totalHits).toBe(0);
  });

  it("should include count in WHERE clause when conditions exist", async () => {
    let lastCountQuery = "";
    
    const mockClient = {} as { query: (sql: string) => Promise<unknown> };
    mockClient.query = async (sql: string) => {
      if (sql.includes("count()")) {
        lastCountQuery = sql;
      }
      return createMockQueryResult([], [{ name: "cnt", type: "UInt64" }]);
    };

    const iterator = fetchChunks({
      client: mockClient,
      tableSource: "test.table",
      whereConditions: ["status = 'active'", "type = 'user'"],
      timeColumn: "timestamp",
      minTime: "2024-01-01T00:00:00Z",
      maxTime: "2024-01-01T23:59:59Z",
      limit: 10,
      selectClause: "*",
      orderByClause: "ORDER BY timestamp DESC",
      safeTimeCol: "timestamp",
    });

    for await (const _chunk of iterator) {
      // consume
    }

    expect(lastCountQuery).toContain("status = 'active'");
    expect(lastCountQuery).toContain("type = 'user'");
    expect(lastCountQuery).toContain("WHERE");
  });
});
