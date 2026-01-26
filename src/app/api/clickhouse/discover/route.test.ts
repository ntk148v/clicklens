import { describe, expect, it, mock, beforeEach } from "bun:test";
import { GET } from "./route";

// Mock dependencies
const mockGetSession = mock();
const mockGetUserConfig = mock();
const mockCreateClient = mock();
const mockQuery = mock();

// Mock module imports
mock.module("@/lib/auth", () => ({
  getSession: mockGetSession,
}));

mock.module("@/lib/clickhouse", () => ({
  getUserConfig: mockGetUserConfig,
  createClient: mockCreateClient,
  isClickHouseError: (e: unknown) =>
    (e as { name?: string })?.name === "ClickHouseError",
}));

mock.module("@/lib/clickhouse/cluster", () => ({
  getClusterName: () => Promise.resolve("default_cluster"),
}));

// Mock Request/Response
const createRequest = (url: string) => new Request(url);

// Helper to consume stream
async function consumeStream(res: Response) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (typeof value === "string") {
      result += value;
    } else {
      result += decoder.decode(value);
    }
  }
  return result;
}

describe("Discover API Route", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetUserConfig.mockReset();
    mockCreateClient.mockReset();
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ data: [] }); // Default empty result

    // Default valid session
    mockGetSession.mockResolvedValue({
      isLoggedIn: true,
      user: { username: "testuser" },
    });

    // Default valid config
    mockGetUserConfig.mockReturnValue({
      host: "localhost",
      username: "testuser",
    });

    // Default client mock
    mockCreateClient.mockReturnValue({
      query: mockQuery,
    });
  });

  it("should return 401 if not authenticated", async () => {
    mockGetSession.mockResolvedValue({ isLoggedIn: false });
    const req = createRequest(
      "http://localhost/api/clickhouse/discover?database=sys&table=logs",
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it("should return 400 if database or table missing", async () => {
    const req = createRequest(
      "http://localhost/api/clickhouse/discover?database=sys",
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("should stream data correctly", async () => {
    // Mock metadata query response (count)
    mockQuery.mockResolvedValueOnce({
      data: [{ cnt: 100 }],
    });

    // Mock data query response
    const mockRows = [
      { event_time: "2024-01-01 10:00:00", message: "Error 1" },
      { event_time: "2024-01-01 09:59:59", message: "Error 2" },
    ];
    mockQuery.mockResolvedValueOnce({
      data: mockRows,
    });

    // Added timeColumn to trigger Chunking Path (which calls Count)
    const req = createRequest(
      "http://localhost/api/clickhouse/discover?database=system&table=logs&limit=10&timeColumn=event_time&minTime=2024-01-01T00:00:00Z&maxTime=2025-01-01T00:00:00Z",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/x-ndjson");

    const result = await consumeStream(res);

    const lines = result.split("\n").filter(Boolean);
    if (lines.length !== 3) {
      console.error("Stream Failed. Lines:", JSON.stringify(lines, null, 2));
    }
    expect(lines.length).toBe(3); // Meta + 2 rows

    const meta = JSON.parse(lines[0]);
    expect(meta.meta.totalHits).toBe(100);

    const row1 = JSON.parse(lines[1]);
    expect(row1.message).toBe("Error 1");
  });

  it("should handle Smart Search parameters", async () => {
    // Mock columns fetch for smart search
    mockQuery.mockResolvedValueOnce({
      data: [
        { name: "message", type: "String" },
        { name: "level", type: "String" },
      ],
    });

    // Mock count
    mockQuery.mockResolvedValueOnce({ data: [{ cnt: 5 }] });

    // Mock data
    mockQuery.mockResolvedValueOnce({ data: [] });

    // Added timeColumn and consumed stream
    const req = createRequest(
      "http://localhost/api/clickhouse/discover?database=sys&table=logs&limit=10&timeColumn=event_time&search=error&minTime=2024-01-01T00:00:00Z",
    );
    const res = await GET(req);
    await consumeStream(res);

    const calls = mockQuery.mock.calls;

    if (calls.length < 3) {
      console.error(
        "Smart Search Failed. Calls:",
        JSON.stringify(calls, null, 2),
      );
    }

    // We expect at least 3 calls
    expect(calls.length).toBeGreaterThanOrEqual(3);

    // Call 0: Columns
    // Call 1: Count
    // Call 2: Data
    const dataQueryArg = calls[2] ? calls[2][0] : "";

    expect(dataQueryArg).toContain("WHERE");
    expect(dataQueryArg).toContain("hasToken");
    expect(dataQueryArg).toContain("error");
  });
});
