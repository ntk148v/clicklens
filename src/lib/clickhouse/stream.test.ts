import { fetchChunks } from "./stream";
import { describe, it, expect, mock } from "bun:test";

describe("fetchChunks", () => {
  it("should generate correct SQL with toDateTime64 for time filtering", async () => {
    const mockClient = {
      query: mock(async (query: string) => {
        if (query.includes("count()")) {
          return { data: [{ cnt: 10 }] };
        }
        return { data: [] };
      }) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    };

    const params = {
      client: mockClient,
      tableSource: "test_db.test_table",
      whereConditions: ["1=1"],
      timeColumn: "event_time",
      minTime: "2023-01-01T00:00:00.000Z",
      maxTime: "2023-01-01T06:00:00.000Z",
      limit: 100,
      selectClause: "*",
      orderByClause: "ORDER BY event_time DESC",
      safeTimeCol: "event_time",
    };

    const iterator = fetchChunks(params);
    await iterator.next(); // Meta chunk

    // Trigger first data chunk query
    await iterator.next();

    // Check the calls
    const calls = mockClient.query.mock.calls;
    // Call 0: count query
    // Call 1: data query
    const dataQuery = calls[1][0];

    // MinTime: 2023-01-01T00:00:00.000Z -> 1672531200000
    // MaxTime: 2023-01-01T06:00:00.000Z -> 1672552800000
    // ChunkSize is 6h (21600000 ms). Total range is exactly 6h.
    // So one chunk.
    // High = 1672552800000. Low = 1672531200000.

    // We expect:
    // event_time <= toDateTime64(1672552800, 3)  (High)
    // event_time >= toDateTime64(1672531200, 3)  (Low)

    expect(dataQuery).toContain("toDateTime64(1672552800, 3)");
    expect(dataQuery).toContain("toDateTime64(1672531200, 3)");
  });
});
