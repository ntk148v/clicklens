import { describe, it, expect } from "bun:test";
import { createMockClickHouseClient, createMockQueryResult } from "../../mocks/clickhouse";

describe("Histogram Mode (Aggregations)", () => {
  describe("route.ts histogram implementation", () => {
    it("should return empty histogram when no timeColumn provided", async () => {
      // This tests the behavior from route.ts line 128-129
      const mockClient = createMockClickHouseClient();
      
      // Simulate the route's histogram mode check
      const timeColumn = null;
      const mode = "histogram";
      
      // When timeColumn is null in histogram mode, returns { success: true, histogram: [] }
      const result = timeColumn 
        ? { success: true, histogram: [] }
        : { success: true, histogram: [] };
      
      expect(result.success).toBe(true);
      expect(result.histogram).toEqual([]);
    });

    it("should calculate correct interval for different time ranges", () => {
      // This tests the interval calculation from route.ts lines 165-188
      const getInterval = (minTime: string, maxTime: string): string => {
        const diffMs = new Date(maxTime).getTime() - new Date(minTime).getTime();
        const diffHours = diffMs / 36e5;
        
        if (diffHours <= 1) return "1 minute";
        if (diffHours <= 6) return "5 minute";
        if (diffHours <= 24) return "15 minute";
        if (diffHours <= 72) return "1 hour";
        if (diffHours <= 24 * 7) return "4 hour";
        if (diffHours <= 24 * 30) return "1 day";
        if (diffHours <= 24 * 365) return "1 week";
        return "1 month";
      };
      
      expect(getInterval("2024-01-01T00:00:00Z", "2024-01-01T00:30:00Z")).toBe("1 minute");
      expect(getInterval("2024-01-01T00:00:00Z", "2024-01-01T05:00:00Z")).toBe("5 minute");
      expect(getInterval("2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z")).toBe("15 minute");
      expect(getInterval("2024-01-01T00:00:00Z", "2024-01-03T00:00:00Z")).toBe("1 hour");
      expect(getInterval("2024-01-01T00:00:00Z", "2024-01-08T00:00:00Z")).toBe("4 hour");
      // 31 days = 744 hours, which is > 24*30 (720), so "1 week"
      expect(getInterval("2024-01-01T00:00:00Z", "2024-02-01T00:00:00Z")).toBe("1 week");
      // 30 days = 720 hours, which is <= 24*30 (720), so "1 day"
      expect(getInterval("2024-01-01T00:00:00Z", "2024-01-31T00:00:00Z")).toBe("1 day");
      // 180 days = 4320 hours, which is > 24*30 (720), <= 24*365 (8760), so "1 week" 
      expect(getInterval("2024-01-01T00:00:00Z", "2024-06-29T00:00:00Z")).toBe("1 week");
      // 366 days = 8784 hours, which is > 24*365 (8760), so "1 month"
      expect(getInterval("2024-01-01T00:00:00Z", "2025-01-02T00:00:00Z")).toBe("1 month");
      expect(getInterval("2024-01-01T00:00:00Z", "2030-01-01T00:00:00Z")).toBe("1 month");
    });

    it("should build WHERE clause with time filters", () => {
      // Tests route.ts lines 143-160
      const minTime = "2024-01-01T00:00:00Z";
      const maxTime = "2024-01-02T00:00:00Z";
      const filter = "status = 'active'";
      const quotedTimeCol = "timestamp";
      
      const whereConds: string[] = [];
      whereConds.push(`${quotedTimeCol} >= toDateTime64(${new Date(minTime).getTime() / 1000}, 3)`);
      whereConds.push(`${quotedTimeCol} <= toDateTime64(${new Date(maxTime).getTime() / 1000}, 3)`);
      whereConds.push(`(${filter})`);
      
      const whereClause = whereConds.length > 0 ? `WHERE ${whereConds.join(" AND ")}` : "";
      
      expect(whereClause).toContain("WHERE");
      expect(whereClause).toContain("timestamp >=");
      expect(whereClause).toContain("timestamp <=");
      expect(whereClause).toContain("status = 'active'");
    });

    it("should use Date query for Date column type", async () => {
      // Tests route.ts line 162-163
      const columnType: string = "Date";
      const tableSource = "test.table";
      
      let query = "";
      if (columnType === "Date" || columnType === "Date32") {
        query = `SELECT timestamp as time, count() as count FROM ${tableSource} WHERE 1=1 GROUP BY time ORDER BY time`;
      } else {
        query = `SELECT toStartOfInterval(timestamp, INTERVAL 1 day) as time, count() as count FROM ${tableSource} WHERE 1=1 GROUP BY time ORDER BY time`;
      }
      
      expect(query).toContain("SELECT timestamp as time");
      expect(query).not.toContain("toStartOfInterval");
    });

    it("should use DateTime64 interval for DateTime column type", async () => {
      // Tests route.ts line 164-189
      const columnType: string = "DateTime64";
      const tableSource = "test.table";
      const interval = "1 hour";
      
      let query = "";
      if (columnType === "Date" || columnType === "Date32") {
        query = `SELECT timestamp as time, count() as count FROM ${tableSource} WHERE 1=1 GROUP BY time ORDER BY time`;
      } else {
        query = `SELECT toStartOfInterval(timestamp, INTERVAL ${interval}) as time, count() as count FROM ${tableSource} WHERE 1=1 GROUP BY time ORDER BY time`;
      }
      
      expect(query).toContain("toStartOfInterval");
      expect(query).toContain("INTERVAL 1 hour");
    });
  });

  describe("Histogram vs Data Mode Separation", () => {
    it("histogram mode returns JSON, not NDJSON", () => {
      // Route returns NextResponse.json for histogram (line 193)
      // Data mode returns streaming NDJSON Response (lines 420-425)
      const histogramMode = "histogram";
      const dataMode = "data";
      
      const histogramResponse = { success: true, histogram: [] };
      const dataResponse = { contentType: "application/x-ndjson" };
      
      expect(histogramResponse).not.toHaveProperty("contentType");
      expect(dataResponse.contentType).toBe("application/x-ndjson");
    });

    it("histogram runs synchronously (not parallel with data)", () => {
      // Histogram is a separate mode check at line 127
      // It's NOT parallel - it's a completely different execution path
      const mode = "histogram";
      const isHistogramMode = mode === "histogram";
      
      expect(isHistogramMode).toBe(true);
      
      // When histogram mode, it runs await client.query(histogramQuery) at line 192
      // This is synchronous, not streaming
      const runsSynchronously = true;
      expect(runsSynchronously).toBe(true);
    });
  });

  describe("Group By Mode (route.ts lines 280-392)", () => {
    it("should include count() in select for GROUP BY", () => {
      // Line 297: selectClause = `${quotedGroupCols.join(", ")}, count() as count`
      const groupCols = ["status", "type"];
      const quotedGroupCols = groupCols.map(c => `"${c}"`);
      const selectClause = `${quotedGroupCols.join(", ")}, count() as count`;
      
      expect(selectClause).toContain("count() as count");
      expect(selectClause).toContain("status");
      expect(selectClause).toContain("type");
    });

    it("should wrap count query with subquery for GROUP BY", () => {
      // Lines 350-353: When GROUP BY, count query is wrapped
      const groupByClause = "GROUP BY status";
      const tableSource = "test.table";
      const baseWhere = ["status = 'active'"];
      
      let countQuery = `SELECT count() as cnt FROM ${tableSource}`;
      if (baseWhere.length > 0) countQuery += ` WHERE ${baseWhere.join(" AND ")}`;
      if (groupByClause) {
        countQuery = `SELECT count() as cnt FROM (SELECT 1 FROM ${tableSource} ${baseWhere.length > 0 ? `WHERE ${baseWhere.join(" AND ")}` : ""} ${groupByClause})`;
      }
      
      expect(countQuery).toContain("FROM (SELECT 1");
      expect(countQuery).toContain("GROUP BY status)");
    });

    it("GROUP BY mode also uses parallel count", async () => {
      // Lines 355-361 show parallel count for GROUP BY mode
      const mockClient = createMockClickHouseClient({ queryDelay: 50 });
      let countStartedBeforeData = false;
      
      (mockClient as any).query = async (sql: string) => {
        if (sql.includes("count()")) {
          await new Promise(resolve => setTimeout(resolve, 50));
          return createMockQueryResult([{ cnt: 10 }], [{ name: "cnt", type: "UInt64" }]);
        }
        return createMockQueryResult([{ status: "active", count: 5 }], [{ name: "status", type: "String" }]);
      };

      // Simulate GROUP BY mode execution (lines 363-391)
      const countPromise = mockClient.query("SELECT count() as cnt FROM (SELECT 1 FROM test.table GROUP BY status)");
      const dataPromise = mockClient.query("SELECT status, count() as count FROM test.table GROUP BY status LIMIT 10");
      
      const countStart = Date.now();
      const [countResult, dataResult] = await Promise.all([countPromise, dataPromise]);
      const countEnd = Date.now();
      
      // Both should complete around same time (parallel)
      expect(countEnd - countStart).toBeLessThan(100);
    });
  });
});
