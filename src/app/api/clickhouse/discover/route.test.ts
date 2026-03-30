import { describe, expect, it, mock, beforeEach } from "bun:test";
import { NextResponse } from "next/server";
import { GET } from "./route";

// Mock dependencies
const mockGetSession = mock();
const mockGetUserConfig = mock();
const mockCreateClient = mock();
const mockQuery = mock();
const mockCheckPermission = mock();

// Mock module imports
mock.module("@/lib/auth", () => ({
  getSession: mockGetSession,
  checkPermission: mockCheckPermission,
  requireAuth: async () => {
    const session = await mockGetSession();
    if (!session.isLoggedIn || !session.user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }
    return { session, config: mockGetUserConfig() };
  },
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
    mockCheckPermission.mockReset();
    mockQuery.mockResolvedValue({ data: [] });

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

    // Default: permission granted
    mockCheckPermission.mockResolvedValue(null);

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
    // Mock getTableEngine
    mockQuery.mockResolvedValueOnce({
      data: [{ engine: "MergeTree" }],
    });

    // Mock getEstimatedRows (called by executeApproxCount)
    mockQuery.mockResolvedValueOnce({
      data: [{ cnt: 1000000 }],
    });

    // Mock data query response
    const mockRows = [
      { event_time: "2024-01-01 10:00:00", message: "Error 1" },
      { event_time: "2024-01-01 09:59:59", message: "Error 2" },
    ];
    mockQuery.mockResolvedValueOnce({
      data: mockRows,
    });

    // Use 30-min range (below 24h threshold) to avoid time windowing
    const req = createRequest(
      "http://localhost/api/clickhouse/discover?database=system&table=logs&limit=10&timeColumn=event_time&minTime=2024-01-01T09:00:00Z&maxTime=2024-01-01T09:30:00Z",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/x-ndjson");

    const result = await consumeStream(res);

    const lines = result.split("\n").filter(Boolean);
    // Preliminary meta (-1) + 2 rows + trailing meta (resolved count)
    if (lines.length !== 4) {
      console.error("Stream Failed. Lines:", JSON.stringify(lines, null, 2));
    }
    expect(lines.length).toBe(4);

    const prelimMeta = JSON.parse(lines[0]);
    expect(prelimMeta.meta.totalHits).toBe(-1);

    const row1 = JSON.parse(lines[1]);
    expect(row1.message).toBe("Error 1");

    const trailingMeta = JSON.parse(lines[3]);
    expect(trailingMeta.meta.totalHits).toBe(1000000);
  });

  it("should handle Smart Search parameters", async () => {
    // Mock getTableEngine
    mockQuery.mockResolvedValueOnce({
      data: [{ engine: "MergeTree" }],
    });

    // Mock columns fetch for smart search
    mockQuery.mockResolvedValueOnce({
      data: [
        { name: "message", type: "String" },
        { name: "level", type: "String" },
      ],
    });

    // Mock getEstimatedRows (called by executeApproxCount)
    mockQuery.mockResolvedValueOnce({
      data: [{ cnt: 1000000 }],
    });

    // Mock data
    mockQuery.mockResolvedValueOnce({ data: [] });

    // Use 30-min range to avoid windowing
    const req = createRequest(
      "http://localhost/api/clickhouse/discover?database=sys&table=logs&limit=10&timeColumn=event_time&search=error&minTime=2024-01-01T09:00:00Z&maxTime=2024-01-01T09:30:00Z",
    );
    const res = await GET(req);
    await consumeStream(res);

    const calls = mockQuery.mock.calls;

    if (calls.length < 4) {
      console.error(
        "Smart Search Failed. Calls:",
        JSON.stringify(calls, null, 2),
      );
    }

    expect(calls.length).toBeGreaterThanOrEqual(4);

    // Call 0: getTableEngine
    // Call 1: columns query
    // Call 2: getEstimatedRows
    // Call 3: chunk data query (with hasToken)
    const dataQueryArg = calls[3] ? calls[3][0] : "";

    expect(dataQueryArg).toContain("WHERE");
    expect(dataQueryArg).toContain("hasToken");
    expect(dataQueryArg).toContain("error");
  });
});
