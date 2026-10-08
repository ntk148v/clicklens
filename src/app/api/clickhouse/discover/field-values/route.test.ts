import { describe, expect, it, mock, beforeEach } from "bun:test";
import { NextResponse } from "next/server";
import { GET } from "./route";

const mockGetUserConfig = mock();
const mockCreateClient = mock();
const mockQuery = mock();

mock.module("@/lib/auth", () => ({
  requireAuth: async () => ({ session: {}, config: mockGetUserConfig() }),
}));

mock.module("@/lib/clickhouse", () => ({
  getUserConfig: mockGetUserConfig,
  createClient: mockCreateClient,
  isClickHouseError: (e: unknown) =>
    (e as { name?: string })?.name === "ClickHouseError",
}));

mock.module("@/lib/clickhouse/cluster", () => ({
  getClusterName: () => Promise.resolve(null),
}));

mock.module("@/lib/clickhouse/schema", () => ({
  getTableEngine: () => Promise.resolve("MergeTree"),
}));

const base =
  "http://localhost/api/clickhouse/discover/field-values?database=sys&table=logs&column=level";

describe("Discover field-values route", () => {
  beforeEach(() => {
    mockGetUserConfig.mockReset();
    mockCreateClient.mockReset();
    mockQuery.mockReset();
    mockGetUserConfig.mockReturnValue({ host: "localhost" });
    mockCreateClient.mockReturnValue({ query: mockQuery });
    mockQuery.mockResolvedValue({ data: [] });
  });

  it("rejects a filter that breaks out of the WHERE clause", async () => {
    const filter = encodeURIComponent("1=1) OR (1=1");
    const res = (await GET(new Request(`${base}&filter=${filter}`))) as
      | NextResponse
      | Response;

    expect(res.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("queries with the regenerated filter SQL", async () => {
    const filter = encodeURIComponent("level='Error'");
    const res = await GET(new Request(`${base}&filter=${filter}`));

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("WHERE");
    expect(sql).toContain("(level = 'Error')");
    expect(sql).not.toContain("level='Error'");
  });
});
