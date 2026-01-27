import { describe, expect, it, mock, beforeEach } from "bun:test";
import { POST } from "./route";

// Mock dependencies
const mockGetSessionClickHouseConfig = mock();
const mockCreateClient = mock();
const mockQueryStream = mock();

// Mock module imports
mock.module("@/lib/auth", () => ({
  getSessionClickHouseConfig: mockGetSessionClickHouseConfig,
}));

mock.module("@/lib/clickhouse", () => ({
  createClient: mockCreateClient,
}));

import { NextRequest } from "next/server";

// Mock Request
const createRequest = (body: unknown) =>
  new Request("http://localhost/api/clickhouse/query", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as NextRequest;

// Helper to consume stream and return chunks
async function consumeStreamChunks(res: Response) {
  if (!res.body) return [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value));
  }
  return chunks;
}

// Helper to simulate ClickHouse stream
async function* mockStreamGenerator(data: unknown[]) {
  // First chunk: columns (wrapped as a batch of 1 row)
  yield [["id", "name"]];
  // Second chunk: types
  yield [["UInt64", "String"]];
  // Data chunks
  for (const item of data) {
    yield [item];
  }
}

describe("Query API Route (Streaming)", () => {
  beforeEach(() => {
    mockGetSessionClickHouseConfig.mockReset();
    mockCreateClient.mockReset();
    mockQueryStream.mockReset();

    // Default valid session
    mockGetSessionClickHouseConfig.mockResolvedValue({
      host: "localhost",
      username: "testuser",
    });

    // Default client mock
    mockCreateClient.mockReturnValue({
      queryStream: mockQueryStream,
    });
  });

  it("should batch rows into chunks of 1000", async () => {
    // Generate 2500 rows
    const totalRows = 2500;
    const mockData = Array.from({ length: totalRows }, (_, i) => ({
      id: i,
      name: `Row ${i}`,
    }));

    mockQueryStream.mockResolvedValue({
      stream: () => mockStreamGenerator(mockData),
    });

    const req = createRequest({ sql: "SELECT * FROM test" });
    const res = await POST(req);

    expect(res.status).toBe(200);

    const rawChunks = await consumeStreamChunks(res);
    const fullOutput = rawChunks.join("");
    const lines = fullOutput.split("\n").filter(Boolean);

    // Verify output structure
    // Line 1: Meta
    const meta = JSON.parse(lines[0]);
    expect(meta.type).toBe("meta");

    // Subsequent lines: Data batches or progress
    const dataLines = lines.filter((l) => JSON.parse(l).type === "data");
    
    // Check batch sizes
    // We expect 2 batches of 1000 and 1 batch of 500
    // Note: progress events might be interleaved
    let totalReceived = 0;
    for (const line of dataLines) {
      const parsed = JSON.parse(line);
      const batchSize = parsed.data.length;
      totalReceived += batchSize;
      
      // Batch size should be <= 1000
      expect(batchSize).toBeLessThanOrEqual(1000);
    }

    expect(totalReceived).toBe(totalRows);
    
    // Expect at least 3 data batches (1000, 1000, 500)
    expect(dataLines.length).toBeGreaterThanOrEqual(3);
  });

  it("should handle small result sets (no batching needed)", async () => {
    const mockData = [{ id: 1, name: "Test" }];

    mockQueryStream.mockResolvedValue({
      stream: () => mockStreamGenerator(mockData),
    });

    const req = createRequest({ sql: "SELECT * FROM test LIMIT 1" });
    const res = await POST(req);

    expect(res.status).toBe(200);

    const rawChunks = await consumeStreamChunks(res);
    const fullOutput = rawChunks.join("");
    const lines = fullOutput.split("\n").filter(Boolean);

    const dataLines = lines.filter((l) => JSON.parse(l).type === "data");
    expect(dataLines.length).toBe(1);
    expect(JSON.parse(dataLines[0]).data.length).toBe(1);
  });
});
