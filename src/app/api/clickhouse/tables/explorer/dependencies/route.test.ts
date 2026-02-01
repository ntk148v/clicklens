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
  const url = new URL(
    "http://localhost/api/clickhouse/tables/explorer/dependencies"
  );
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new Request(url.toString(), {
    method: "GET",
  }) as unknown as NextRequest;
};

// Helper to set up mock query responses
// First call is for database tables, second call is for all tables (validation)
const setupMockQueries = (
  databaseTables: object[],
  allTables?: { database: string; name: string; engine: string }[]
) => {
  let callCount = 0;
  mockQuery.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({ data: databaseTables });
    } else {
      // Return all tables for validation (default: same as database tables)
      const validationData =
        allTables ||
        databaseTables.map((t: Record<string, unknown>) => ({
          database: t.database,
          name: t.name,
          engine: t.engine,
        }));
      return Promise.resolve({ data: validationData });
    }
  });
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
      setupMockQueries([], []);

      const req = createRequest({ database: "empty_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.nodes).toEqual([]);
      expect(json.data.edges).toEqual([]);
    });

    it("should return nodes for tables without dependencies", async () => {
      setupMockQueries([
        {
          database: "test_db",
          name: "users",
          engine: "MergeTree",
          total_rows: 1000,
          total_bytes: 50000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query:
            "CREATE TABLE test_db.users (id UInt64) ENGINE = MergeTree()",
        },
      ]);

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.nodes).toHaveLength(1);
      expect(json.data.edges).toHaveLength(0);
    });

    it("should create source edges from dependencies_table column", async () => {
      setupMockQueries([
        {
          database: "test_db",
          name: "events",
          engine: "MergeTree",
          total_rows: 10000,
          total_bytes: 500000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.events ...",
        },
        {
          database: "test_db",
          name: "events_hourly",
          engine: "MaterializedView",
          total_rows: null,
          total_bytes: null,
          dependencies_database: ["test_db"],
          dependencies_table: ["events"],
          create_table_query:
            "CREATE MATERIALIZED VIEW test_db.events_hourly AS SELECT * FROM test_db.events",
        },
      ]);

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.edges.length).toBeGreaterThanOrEqual(1);

      const sourceEdge = json.data.edges.find(
        (e: { type: string }) => e.type === "source"
      );
      expect(sourceEdge).toBeDefined();
      expect(sourceEdge.source).toBe("test_db.events");
      expect(sourceEdge.target).toBe("test_db.events_hourly");
    });
  });

  describe("FROM Clause Parsing", () => {
    it("should extract source tables from View FROM clause", async () => {
      setupMockQueries([
        {
          database: "test_db",
          name: "events",
          engine: "MergeTree",
          total_rows: 1000,
          total_bytes: 50000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.events ...",
        },
        {
          database: "test_db",
          name: "events_view",
          engine: "View",
          total_rows: null,
          total_bytes: null,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query:
            "CREATE VIEW test_db.events_view AS SELECT * FROM test_db.events",
        },
      ]);

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      const sourceEdge = json.data.edges.find(
        (e: { type: string; target: string }) =>
          e.type === "source" && e.target === "test_db.events_view"
      );
      expect(sourceEdge).toBeDefined();
      expect(sourceEdge.source).toBe("test_db.events");
    });

    it("should extract source tables from MV FROM clause", async () => {
      setupMockQueries([
        {
          database: "test_db",
          name: "events",
          engine: "MergeTree",
          total_rows: 1000,
          total_bytes: 50000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.events ...",
        },
        {
          database: "test_db",
          name: "hourly_stats",
          engine: "SummingMergeTree",
          total_rows: 100,
          total_bytes: 5000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.hourly_stats ...",
        },
        {
          database: "test_db",
          name: "mv_hourly",
          engine: "MaterializedView",
          total_rows: null,
          total_bytes: null,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query:
            "CREATE MATERIALIZED VIEW test_db.mv_hourly TO test_db.hourly_stats AS SELECT toStartOfHour(ts) as hour, count() as cnt FROM test_db.events GROUP BY hour",
        },
      ]);

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      // Should have source edge from events to mv_hourly
      const sourceEdge = json.data.edges.find(
        (e: { type: string; source: string; target: string }) =>
          e.type === "source" &&
          e.source === "test_db.events" &&
          e.target === "test_db.mv_hourly"
      );
      expect(sourceEdge).toBeDefined();

      // Should have target edge from mv_hourly to hourly_stats
      const targetEdge = json.data.edges.find(
        (e: { type: string }) => e.type === "target"
      );
      expect(targetEdge).toBeDefined();
      expect(targetEdge.source).toBe("test_db.mv_hourly");
      expect(targetEdge.target).toBe("test_db.hourly_stats");
    });

    it("should handle FROM with table alias", async () => {
      setupMockQueries([
        {
          database: "test_db",
          name: "events",
          engine: "MergeTree",
          total_rows: 1000,
          total_bytes: 50000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.events ...",
        },
        {
          database: "test_db",
          name: "events_view",
          engine: "View",
          total_rows: null,
          total_bytes: null,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query:
            "CREATE VIEW test_db.events_view AS SELECT e.* FROM test_db.events AS e",
        },
      ]);

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      const sourceEdge = json.data.edges.find(
        (e: { type: string; target: string }) =>
          e.type === "source" && e.target === "test_db.events_view"
      );
      expect(sourceEdge).toBeDefined();
      expect(sourceEdge.source).toBe("test_db.events");
    });
  });

  describe("Comment and String Stripping", () => {
    it("should not match table names in single-line comments", async () => {
      setupMockQueries(
        [
          {
            database: "test_db",
            name: "real_table",
            engine: "MergeTree",
            total_rows: 1000,
            total_bytes: 50000,
            dependencies_database: [],
            dependencies_table: [],
            create_table_query: "CREATE TABLE test_db.real_table ...",
          },
          {
            database: "test_db",
            name: "my_view",
            engine: "View",
            total_rows: null,
            total_bytes: null,
            dependencies_database: [],
            dependencies_table: [],
            create_table_query:
              "CREATE VIEW test_db.my_view AS SELECT * FROM test_db.real_table -- JOIN fake_table ON ...",
          },
        ],
        [
          { database: "test_db", name: "real_table", engine: "MergeTree" },
          { database: "test_db", name: "my_view", engine: "View" },
        ]
      );

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      // Should NOT have a join edge to fake_table
      const joinEdges = json.data.edges.filter(
        (e: { type: string }) => e.type === "join"
      );
      expect(joinEdges).toHaveLength(0);
    });

    it("should not match table names in block comments", async () => {
      setupMockQueries(
        [
          {
            database: "test_db",
            name: "real_table",
            engine: "MergeTree",
            total_rows: 1000,
            total_bytes: 50000,
            dependencies_database: [],
            dependencies_table: [],
            create_table_query: "CREATE TABLE test_db.real_table ...",
          },
          {
            database: "test_db",
            name: "my_view",
            engine: "View",
            total_rows: null,
            total_bytes: null,
            dependencies_database: [],
            dependencies_table: [],
            create_table_query:
              "CREATE VIEW test_db.my_view AS SELECT * FROM test_db.real_table /* JOIN fake_table ON id = id */",
          },
        ],
        [
          { database: "test_db", name: "real_table", engine: "MergeTree" },
          { database: "test_db", name: "my_view", engine: "View" },
        ]
      );

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      // Should NOT have a join edge to fake_table
      const joinEdges = json.data.edges.filter(
        (e: { type: string }) => e.type === "join"
      );
      expect(joinEdges).toHaveLength(0);
    });
  });

  describe("External Table Validation", () => {
    it("should not create nodes for non-existent external tables", async () => {
      setupMockQueries(
        [
          {
            database: "test_db",
            name: "my_view",
            engine: "View",
            total_rows: null,
            total_bytes: null,
            dependencies_database: ["test_db"],
            dependencies_table: ["non_existent_table"],
            create_table_query:
              "CREATE VIEW test_db.my_view AS SELECT * FROM test_db.non_existent_table",
          },
        ],
        [{ database: "test_db", name: "my_view", engine: "View" }]
      );

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      // Should only have the view node, not the non-existent table
      expect(json.data.nodes).toHaveLength(1);
      expect(json.data.nodes[0].name).toBe("my_view");

      // Should have no edges since the source table doesn't exist
      expect(json.data.edges).toHaveLength(0);
    });

    it("should create nodes for external tables that exist in other databases", async () => {
      setupMockQueries(
        [
          {
            database: "test_db",
            name: "my_view",
            engine: "View",
            total_rows: null,
            total_bytes: null,
            dependencies_database: ["other_db"],
            dependencies_table: ["external_table"],
            create_table_query:
              "CREATE VIEW test_db.my_view AS SELECT * FROM other_db.external_table",
          },
        ],
        [
          { database: "test_db", name: "my_view", engine: "View" },
          { database: "other_db", name: "external_table", engine: "MergeTree" },
        ]
      );

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      // Should have both nodes
      expect(json.data.nodes).toHaveLength(2);

      const externalNode = json.data.nodes.find(
        (n: { id: string }) => n.id === "other_db.external_table"
      );
      expect(externalNode).toBeDefined();
      expect(externalNode.engine).toBe("MergeTree");

      // Should have source edge
      expect(json.data.edges).toHaveLength(1);
      expect(json.data.edges[0].source).toBe("other_db.external_table");
    });
  });

  describe("Create Query Parsing", () => {
    it("should extract MV target table from TO clause", async () => {
      setupMockQueries([
        {
          database: "test_db",
          name: "source_table",
          engine: "MergeTree",
          total_rows: 1000,
          total_bytes: 50000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.source_table ...",
        },
        {
          database: "test_db",
          name: "target_table",
          engine: "MergeTree",
          total_rows: 500,
          total_bytes: 25000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.target_table ...",
        },
        {
          database: "test_db",
          name: "my_mv",
          engine: "MaterializedView",
          total_rows: null,
          total_bytes: null,
          dependencies_database: ["test_db"],
          dependencies_table: ["source_table"],
          create_table_query:
            "CREATE MATERIALIZED VIEW test_db.my_mv TO test_db.target_table AS SELECT * FROM test_db.source_table",
        },
      ]);

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      // Should have target edge
      const targetEdge = json.data.edges.find(
        (e: { type: string }) => e.type === "target"
      );
      expect(targetEdge).toBeDefined();
      expect(targetEdge.source).toBe("test_db.my_mv");
      expect(targetEdge.target).toBe("test_db.target_table");
    });

    it("should extract joined tables from JOIN clause", async () => {
      setupMockQueries([
        {
          database: "test_db",
          name: "orders",
          engine: "MergeTree",
          total_rows: 1000,
          total_bytes: 50000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.orders ...",
        },
        {
          database: "test_db",
          name: "users",
          engine: "MergeTree",
          total_rows: 100,
          total_bytes: 5000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.users ...",
        },
        {
          database: "test_db",
          name: "order_details_mv",
          engine: "MaterializedView",
          total_rows: null,
          total_bytes: null,
          dependencies_database: ["test_db"],
          dependencies_table: ["orders"],
          create_table_query:
            "CREATE MATERIALIZED VIEW test_db.order_details_mv AS SELECT * FROM test_db.orders LEFT JOIN test_db.users ON orders.user_id = users.id",
        },
      ]);

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      // Should have join edge
      const joinEdge = json.data.edges.find(
        (e: { type: string }) => e.type === "join"
      );
      expect(joinEdge).toBeDefined();
      expect(joinEdge.source).toBe("test_db.users");
      expect(joinEdge.target).toBe("test_db.order_details_mv");
    });

    it("should extract Distributed table local reference", async () => {
      setupMockQueries([
        {
          database: "test_db",
          name: "events_local",
          engine: "MergeTree",
          total_rows: 1000,
          total_bytes: 50000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.events_local ...",
        },
        {
          database: "test_db",
          name: "events_distributed",
          engine: "Distributed",
          total_rows: null,
          total_bytes: null,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query:
            "CREATE TABLE test_db.events_distributed (id UInt64) ENGINE = Distributed('cluster', 'test_db', 'events_local', rand())",
        },
      ]);

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      // Should have distributed edge
      const distEdge = json.data.edges.find(
        (e: { type: string }) => e.type === "distributed"
      );
      expect(distEdge).toBeDefined();
      expect(distEdge.source).toBe("test_db.events_distributed");
      expect(distEdge.target).toBe("test_db.events_local");
    });

    it("should extract dictionary references from dictGet functions", async () => {
      setupMockQueries([
        {
          database: "test_db",
          name: "events",
          engine: "MergeTree",
          total_rows: 10000,
          total_bytes: 500000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.events ...",
        },
        {
          database: "test_db",
          name: "my_dict",
          engine: "Dictionary",
          total_rows: 100,
          total_bytes: 5000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE DICTIONARY test_db.my_dict ...",
        },
        {
          database: "test_db",
          name: "enriched_events_mv",
          engine: "MaterializedView",
          total_rows: null,
          total_bytes: null,
          dependencies_database: ["test_db"],
          dependencies_table: ["events"],
          create_table_query:
            "CREATE MATERIALIZED VIEW test_db.enriched_events_mv AS SELECT *, dictGetString('my_dict', 'name', id) as name FROM test_db.events",
        },
      ]);

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      // Should have dictionary edge
      const dictEdge = json.data.edges.find(
        (e: { type: string }) => e.type === "dictionary"
      );
      expect(dictEdge).toBeDefined();
      expect(dictEdge.source).toBe("test_db.my_dict");
      expect(dictEdge.target).toBe("test_db.enriched_events_mv");
    });

    it("should handle multiple JOIN types", async () => {
      setupMockQueries([
        {
          database: "test_db",
          name: "a",
          engine: "MergeTree",
          total_rows: 100,
          total_bytes: 5000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.a ...",
        },
        {
          database: "test_db",
          name: "b",
          engine: "MergeTree",
          total_rows: 100,
          total_bytes: 5000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.b ...",
        },
        {
          database: "test_db",
          name: "c",
          engine: "MergeTree",
          total_rows: 100,
          total_bytes: 5000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "CREATE TABLE test_db.c ...",
        },
        {
          database: "test_db",
          name: "complex_view",
          engine: "View",
          total_rows: null,
          total_bytes: null,
          dependencies_database: ["test_db"],
          dependencies_table: ["a"],
          create_table_query:
            "CREATE VIEW test_db.complex_view AS SELECT * FROM test_db.a INNER JOIN test_db.b ON a.id = b.id LEFT JOIN test_db.c ON b.id = c.id",
        },
      ]);

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      // Should have join edges for b and c
      const joinEdges = json.data.edges.filter(
        (e: { type: string }) => e.type === "join"
      );
      expect(joinEdges.length).toBe(2);
      expect(
        joinEdges.some((e: { source: string }) => e.source === "test_db.b")
      ).toBe(true);
      expect(
        joinEdges.some((e: { source: string }) => e.source === "test_db.c")
      ).toBe(true);
    });
  });

  describe("Edge Types", () => {
    it("should detect table types correctly", async () => {
      setupMockQueries([
        {
          database: "test_db",
          name: "table1",
          engine: "MergeTree",
          total_rows: 100,
          total_bytes: 1000,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "",
        },
        {
          database: "test_db",
          name: "view1",
          engine: "View",
          total_rows: null,
          total_bytes: null,
          dependencies_database: ["test_db"],
          dependencies_table: ["table1"],
          create_table_query: "",
        },
        {
          database: "test_db",
          name: "mv1",
          engine: "MaterializedView",
          total_rows: null,
          total_bytes: null,
          dependencies_database: ["test_db"],
          dependencies_table: ["table1"],
          create_table_query: "",
        },
        {
          database: "test_db",
          name: "dist1",
          engine: "Distributed",
          total_rows: null,
          total_bytes: null,
          dependencies_database: [],
          dependencies_table: [],
          create_table_query: "",
        },
      ]);

      const req = createRequest({ database: "test_db" });
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);

      const nodes = json.data.nodes;
      expect(
        nodes.find((n: { name: string }) => n.name === "table1").type
      ).toBe("table");
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
