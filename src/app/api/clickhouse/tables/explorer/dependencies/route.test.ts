import { describe, expect, it, mock, beforeEach } from "bun:test";
import { GET } from "./route";
import { NextRequest } from "next/server";

// Mock dependencies
const mockGetSession = mock();
const mockCreateClient = mock();
const mockQuery = mock();
const mockGetLensConfig = mock();
const mockIsLensUserConfigured = mock();

// Mock module imports
mock.module("@/lib/auth", () => ({
  getSession: mockGetSession,
}));

mock.module("@/lib/clickhouse", () => ({
  createClient: mockCreateClient,
  getLensConfig: mockGetLensConfig,
  isLensUserConfigured: mockIsLensUserConfigured,
  isClickHouseError: (err: unknown) =>
    err && typeof err === "object" && "code" in err,
}));

// Helper to create GET request with query params
const createRequest = (params: Record<string, string>) => {
  const url = new URL("http://localhost/api/clickhouse/tables/explorer/dependencies");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new Request(url.toString(), {
    method: "GET",
  }) as unknown as NextRequest;
};

describe("Table Dependencies API Route", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockCreateClient.mockReset();
    mockQuery.mockReset();
    mockGetLensConfig.mockReset();
    mockIsLensUserConfigured.mockReset();

    // Default valid session
    mockGetSession.mockResolvedValue({
      isLoggedIn: true,
      user: { username: "testuser" },
    });

    // Default lens config
    mockIsLensUserConfigured.mockReturnValue(true);
    mockGetLensConfig.mockReturnValue({
      host: "localhost",
      username: "lens",
    });

    // Default client mock
    mockCreateClient.mockReturnValue({
      query: mockQuery,
    });
  });

  describe("Authentication", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetSession.mockResolvedValue({
        isLoggedIn: false,
        user: null,
      });

      const req = createRequest({ database: "default" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.type).toBe("AUTH_REQUIRED");
    });

    it("should return 500 when lens user not configured", async () => {
      mockIsLensUserConfigured.mockReturnValue(false);

      const req = createRequest({ database: "default" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error.type).toBe("CONFIG_ERROR");
    });
  });

  describe("Validation", () => {
    it("should return 400 when database parameter is missing", async () => {
      const req = createRequest({});
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.type).toBe("BAD_REQUEST");
    });
  });

  describe("Graph Generation", () => {
    it("should return empty graph when no tables exist", async () => {
      mockQuery.mockResolvedValue({ data: [] });

      const req = createRequest({ database: "empty_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.nodes).toEqual([]);
      expect(json.data.edges).toEqual([]);
    });

    it("should return nodes for tables without dependencies", async () => {
      mockQuery.mockResolvedValue({
        data: [
          {
            database: "test_db",
            name: "users",
            engine: "MergeTree",
            total_rows: 1000,
            total_bytes: 50000,
            dependencies_database: [],
            dependencies_table: [],
          },
          {
            database: "test_db",
            name: "orders",
            engine: "MergeTree",
            total_rows: 5000,
            total_bytes: 100000,
            dependencies_database: [],
            dependencies_table: [],
          },
        ],
      });

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.nodes).toHaveLength(2);
      expect(json.data.edges).toHaveLength(0);

      const userNode = json.data.nodes.find(
        (n: { name: string }) => n.name === "users"
      );
      expect(userNode).toBeDefined();
      expect(userNode.type).toBe("table");
      expect(userNode.totalRows).toBe(1000);
    });

    it("should create edges for materialized view dependencies", async () => {
      mockQuery.mockResolvedValue({
        data: [
          {
            database: "test_db",
            name: "events",
            engine: "MergeTree",
            total_rows: 10000,
            total_bytes: 500000,
            dependencies_database: [],
            dependencies_table: [],
          },
          {
            database: "test_db",
            name: "events_hourly",
            engine: "MaterializedView",
            total_rows: null,
            total_bytes: null,
            dependencies_database: ["test_db"],
            dependencies_table: ["events"],
          },
        ],
      });

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.nodes).toHaveLength(2);
      expect(json.data.edges).toHaveLength(1);

      const edge = json.data.edges[0];
      expect(edge.source).toBe("test_db.events");
      expect(edge.target).toBe("test_db.events_hourly");

      const mvNode = json.data.nodes.find(
        (n: { name: string }) => n.name === "events_hourly"
      );
      expect(mvNode.type).toBe("materialized_view");
    });

    it("should detect table types correctly", async () => {
      mockQuery.mockResolvedValue({
        data: [
          {
            database: "test_db",
            name: "table1",
            engine: "MergeTree",
            total_rows: 100,
            total_bytes: 1000,
            dependencies_database: [],
            dependencies_table: [],
          },
          {
            database: "test_db",
            name: "view1",
            engine: "View",
            total_rows: null,
            total_bytes: null,
            dependencies_database: ["test_db"],
            dependencies_table: ["table1"],
          },
          {
            database: "test_db",
            name: "mv1",
            engine: "MaterializedView",
            total_rows: null,
            total_bytes: null,
            dependencies_database: ["test_db"],
            dependencies_table: ["table1"],
          },
          {
            database: "test_db",
            name: "dist1",
            engine: "Distributed",
            total_rows: null,
            total_bytes: null,
            dependencies_database: [],
            dependencies_table: [],
          },
        ],
      });

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      const nodes = json.data.nodes;
      expect(nodes.find((n: { name: string }) => n.name === "table1").type).toBe(
        "table"
      );
      expect(nodes.find((n: { name: string }) => n.name === "view1").type).toBe(
        "view"
      );
      expect(nodes.find((n: { name: string }) => n.name === "mv1").type).toBe(
        "materialized_view"
      );
      expect(nodes.find((n: { name: string }) => n.name === "dist1").type).toBe(
        "distributed"
      );
    });

    it("should add external dependency nodes", async () => {
      mockQuery.mockResolvedValue({
        data: [
          {
            database: "test_db",
            name: "local_mv",
            engine: "MaterializedView",
            total_rows: null,
            total_bytes: null,
            dependencies_database: ["other_db"],
            dependencies_table: ["source_table"],
          },
        ],
      });

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.nodes).toHaveLength(2);

      const externalNode = json.data.nodes.find(
        (n: { id: string }) => n.id === "other_db.source_table"
      );
      expect(externalNode).toBeDefined();
      expect(externalNode.engine).toBe("Unknown");

      const edge = json.data.edges[0];
      expect(edge.source).toBe("other_db.source_table");
      expect(edge.target).toBe("test_db.local_mv");
    });

    it("should handle multiple dependencies", async () => {
      mockQuery.mockResolvedValue({
        data: [
          {
            database: "test_db",
            name: "source1",
            engine: "MergeTree",
            total_rows: 100,
            total_bytes: 1000,
            dependencies_database: [],
            dependencies_table: [],
          },
          {
            database: "test_db",
            name: "source2",
            engine: "MergeTree",
            total_rows: 200,
            total_bytes: 2000,
            dependencies_database: [],
            dependencies_table: [],
          },
          {
            database: "test_db",
            name: "combined_view",
            engine: "View",
            total_rows: null,
            total_bytes: null,
            dependencies_database: ["test_db", "test_db"],
            dependencies_table: ["source1", "source2"],
          },
        ],
      });

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.nodes).toHaveLength(3);
      expect(json.data.edges).toHaveLength(2);

      const edges = json.data.edges;
      expect(
        edges.some(
          (e: { source: string; target: string }) =>
            e.source === "test_db.source1" &&
            e.target === "test_db.combined_view"
        )
      ).toBe(true);
      expect(
        edges.some(
          (e: { source: string; target: string }) =>
            e.source === "test_db.source2" &&
            e.target === "test_db.combined_view"
        )
      ).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle ClickHouse errors gracefully", async () => {
      const clickhouseError = {
        code: 60,
        message: "Table does not exist",
        type: "UNKNOWN_TABLE",
        userMessage: "Table not found",
      };

      mockQuery.mockRejectedValue(clickhouseError);

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe(60);
    });

    it("should handle unexpected errors", async () => {
      mockQuery.mockRejectedValue(new Error("Connection failed"));

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(false);
      expect(json.error.type).toBe("INTERNAL_ERROR");
    });
  });
});
