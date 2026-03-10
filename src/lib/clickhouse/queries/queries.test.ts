import { createClient } from "@clickhouse/client";
import { describe, test, afterAll, beforeAll } from "bun:test";
import * as tableQueries from "./tables";
import * as databaseQueries from "./databases";
import * as accessQueries from "./access";
import * as queryAnalysisQueries from "./query-analysis";
import * as settingsQueries from "./settings";
import * as schemaQueries from "./schema";
import * as discoverQueries from "./discover";

// Build connection URL from environment variables (matching ClickLens config approach)
const getConnectionUrl = () => {
  const host = process.env.CLICKHOUSE_HOST || "localhost";
  const port = process.env.CLICKHOUSE_PORT || "8123";
  const secure = process.env.CLICKHOUSE_SECURE === "true";
  const protocol = secure ? "https" : "http";
  return `${protocol}://${host}:${port}`;
};

describe("Centralized Query Modules Validation", () => {
  const client = createClient({
    url: getConnectionUrl(),
    username: process.env.CLICKHOUSE_USER || process.env.LENS_USER || "admin",
    password:
      process.env.CLICKHOUSE_PASSWORD ||
      process.env.LENS_PASSWORD ||
      "password",
  });

  let clickhouseAvailable = false;

  beforeAll(async () => {
    try {
      await client.query({
        query: "SELECT 1",
        format: "JSONEachRow",
      });
      clickhouseAvailable = true;
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).toString();
      if (
        msg.includes("ECONNREFUSED") ||
        msg.includes("ENOTFOUND") ||
        msg.includes("fetch failed") ||
        msg.includes("Authentication failed")
      ) {
        console.warn(
          "⚠️  ClickHouse not available. Skipping centralized query validation tests.",
        );
        clickhouseAvailable = false;
      } else {
        throw e;
      }
    }
  });

  afterAll(async () => {
    await client.close();
  });

  // Helper to wrap query with LIMIT 1, avoiding syntax errors
  const checkQuery = async (sql: string, name: string) => {
    if (!clickhouseAvailable) {
      console.warn(`Skipping ${name}: ClickHouse not available`);
      return;
    }

    try {
      let queryToCheck = sql;
      if (!queryToCheck.toUpperCase().includes("LIMIT")) {
        if (/SETTINGS/i.test(queryToCheck)) {
          queryToCheck = queryToCheck.replace(
            /(\s+SETTINGS\s+)/i,
            "\nLIMIT 1$1",
          );
        } else {
          queryToCheck = `${queryToCheck}\nLIMIT 1`;
        }
      }

      await client.query({
        query: queryToCheck,
        format: "JSONEachRow",
      });
    } catch (e: unknown) {
      const msg = (e instanceof Error ? e.message : String(e)).toString();

      // Handle connection errors gracefully
      if (
        msg.includes("ECONNREFUSED") ||
        msg.includes("ENOTFOUND") ||
        msg.includes("fetch failed")
      ) {
        console.warn(`Skipping ${name}: ClickHouse connection failed`);
        return;
      }

      // Ignore missing tables/clusters we can't control
      if (
        msg.includes("UNKNOWN_TABLE") ||
        msg.includes("Unknown table expression identifier") ||
        (msg.includes("Cluster") && msg.includes("not found")) ||
        (msg.includes("Requested cluster") && msg.includes("not found")) ||
        msg.includes("Table system.query_cache doesn't exist") ||
        msg.includes("Table system.server_settings doesn't exist")
      ) {
        console.warn(`Skipping ${name}: Dependency missing`);
        return;
      }

      throw new Error(`Query "${name}" failed: ${msg}`);
    }
  };

  // ─── Tables Module ────────────────────────────────────────────────────────
  describe("Tables Queries", () => {
    // String constants
    test("ALL_SYSTEM_TABLES_QUERY", async () => {
      await checkQuery(
        tableQueries.ALL_SYSTEM_TABLES_QUERY,
        "ALL_SYSTEM_TABLES_QUERY",
      );
    });

    // Builder functions with sample parameters
    test("getTableOverviewQuery", async () => {
      await checkQuery(
        tableQueries.getTableOverviewQuery("system", "tables"),
        "getTableOverviewQuery",
      );
    });

    test("getColumnStatsQuery", async () => {
      await checkQuery(
        tableQueries.getColumnStatsQuery("system", "tables"),
        "getColumnStatsQuery",
      );
    });

    test("getColumnsFallbackQuery", async () => {
      await checkQuery(
        tableQueries.getColumnsFallbackQuery("system", "tables"),
        "getColumnsFallbackQuery",
      );
    });

    test("getPartsQuery (no cluster)", async () => {
      await checkQuery(
        tableQueries.getPartsQuery("system", "tables"),
        "getPartsQuery",
      );
    });

    test("getTableMergesQuery", async () => {
      await checkQuery(
        tableQueries.getTableMergesQuery("system", "tables"),
        "getTableMergesQuery",
      );
    });

    test("getTableMutationsQuery (no cluster)", async () => {
      await checkQuery(
        tableQueries.getTableMutationsQuery("system", "tables"),
        "getTableMutationsQuery",
      );
    });

    test("getTableReplicasQuery (no cluster)", async () => {
      await checkQuery(
        tableQueries.getTableReplicasQuery("system", "tables"),
        "getTableReplicasQuery",
      );
    });

    test("getTableDependenciesQuery", async () => {
      await checkQuery(
        tableQueries.getTableDependenciesQuery("system"),
        "getTableDependenciesQuery",
      );
    });

    test("getTableStructureQuery", async () => {
      await checkQuery(
        tableQueries.getTableStructureQuery("system", "tables"),
        "getTableStructureQuery",
      );
    });

    test("getTableDataPreviewQuery", async () => {
      await checkQuery(
        tableQueries.getTableDataPreviewQuery("system", "tables", 10),
        "getTableDataPreviewQuery",
      );
    });

    test("getTablesQuery", async () => {
      await checkQuery(tableQueries.getTablesQuery(""), "getTablesQuery");
    });

    test("getTablesForDbQuery", async () => {
      await checkQuery(
        tableQueries.getTablesForDbQuery("system"),
        "getTablesForDbQuery",
      );
    });

    test("getUserRolesQuery", async () => {
      await checkQuery(
        tableQueries.getUserRolesQuery("default"),
        "getUserRolesQuery",
      );
    });

    test("buildGrantFilter", async () => {
      const filter = tableQueries.buildGrantFilter("testuser", []);
      // Just verify it returns a valid string
      await checkQuery(
        `SELECT count() FROM system.grants WHERE ${filter}`,
        "buildGrantFilter",
      );
    });
  });

  // ─── Databases Module ─────────────────────────────────────────────────────
  describe("Databases Queries", () => {
    test("ALL_DATABASES_QUERY", async () => {
      await checkQuery(
        databaseQueries.ALL_DATABASES_QUERY,
        "ALL_DATABASES_QUERY",
      );
    });

    test("getDatabasesWithRbacQuery", async () => {
      await checkQuery(
        databaseQueries.getDatabasesWithRbacQuery("default"),
        "getDatabasesWithRbacQuery",
      );
    });
  });

  // ─── Access Module ────────────────────────────────────────────────────────
  describe("Access Queries", () => {
    test("GRANTS_LIST_QUERY", async () => {
      await checkQuery(
        accessQueries.GRANTS_LIST_QUERY,
        "GRANTS_LIST_QUERY",
      );
    });

    test("USERS_LIST_QUERY", async () => {
      await checkQuery(
        accessQueries.USERS_LIST_QUERY,
        "USERS_LIST_QUERY",
      );
    });

    test("USER_ROLE_GRANTS_QUERY", async () => {
      await checkQuery(
        accessQueries.USER_ROLE_GRANTS_QUERY,
        "USER_ROLE_GRANTS_QUERY",
      );
    });

    test("ROLES_LIST_QUERY", async () => {
      await checkQuery(
        accessQueries.ROLES_LIST_QUERY,
        "ROLES_LIST_QUERY",
      );
    });

    test("ROLE_GRANTS_LIST_QUERY", async () => {
      await checkQuery(
        accessQueries.ROLE_GRANTS_LIST_QUERY,
        "ROLE_GRANTS_LIST_QUERY",
      );
    });

    test("ROLE_PRIVILEGES_QUERY", async () => {
      await checkQuery(
        accessQueries.ROLE_PRIVILEGES_QUERY,
        "ROLE_PRIVILEGES_QUERY",
      );
    });

    test("ROLE_GRANTS_ALL_QUERY", async () => {
      await checkQuery(
        accessQueries.ROLE_GRANTS_ALL_QUERY,
        "ROLE_GRANTS_ALL_QUERY",
      );
    });

    test("CURRENT_USER_QUERY", async () => {
      await checkQuery(
        accessQueries.CURRENT_USER_QUERY,
        "CURRENT_USER_QUERY",
      );
    });

    test("getUserCurrentRolesQuery", async () => {
      await checkQuery(
        accessQueries.getUserCurrentRolesQuery("default"),
        "getUserCurrentRolesQuery",
      );
    });

    test("getRoleInheritedRolesQuery", async () => {
      await checkQuery(
        accessQueries.getRoleInheritedRolesQuery("default"),
        "getRoleInheritedRolesQuery",
      );
    });

    test("getFeatureRolesQuery", async () => {
      await checkQuery(
        accessQueries.getFeatureRolesQuery("clicklens_"),
        "getFeatureRolesQuery",
      );
    });
  });

  // ─── Query Analysis Module ────────────────────────────────────────────────
  describe("Query Analysis Queries", () => {
    const table = "system.query_log";
    const settings = "";
    const whereClause = "WHERE type = 'QueryFinish'";

    test("getQueryHistoryCountQuery", async () => {
      await checkQuery(
        queryAnalysisQueries.getQueryHistoryCountQuery(
          table,
          whereClause,
          settings,
        ),
        "getQueryHistoryCountQuery",
      );
    });

    test("getQueryHistoryQuery", async () => {
      await checkQuery(
        queryAnalysisQueries.getQueryHistoryQuery(
          table,
          whereClause,
          "",
          10,
          0,
          settings,
        ),
        "getQueryHistoryQuery",
      );
    });

    test("getExpensiveQueriesQuery", async () => {
      await checkQuery(
        queryAnalysisQueries.getExpensiveQueriesQuery(
          table,
          "total_duration_ms DESC",
          10,
          settings,
        ),
        "getExpensiveQueriesQuery",
      );
    });

    test("getQuerySummaryQuery", async () => {
      await checkQuery(
        queryAnalysisQueries.getQuerySummaryQuery(table, settings),
        "getQuerySummaryQuery",
      );
    });

    test("getQueryCacheQuery", async () => {
      await checkQuery(
        queryAnalysisQueries.getQueryCacheQuery(
          "system.query_cache",
          "",
          settings,
        ),
        "getQueryCacheQuery",
      );
    });
  });

  // ─── Settings Module ──────────────────────────────────────────────────────
  describe("Settings Queries", () => {
    test("getSessionSettingsQuery", async () => {
      await checkQuery(
        settingsQueries.getSessionSettingsQuery(""),
        "getSessionSettingsQuery",
      );
    });

    test("getServerSettingsQuery", async () => {
      await checkQuery(
        settingsQueries.getServerSettingsQuery(""),
        "getServerSettingsQuery",
      );
    });
  });

  // ─── Schema Module ────────────────────────────────────────────────────────
  describe("Schema Queries", () => {
    test("getTableEngineQuery", async () => {
      await checkQuery(
        schemaQueries.getTableEngineQuery("system", "tables"),
        "getTableEngineQuery",
      );
    });

    test("getColumnTypeQuery", async () => {
      await checkQuery(
        schemaQueries.getColumnTypeQuery("system", "tables"),
        "getColumnTypeQuery",
      );
    });

    test("getColumnNamesQuery", async () => {
      await checkQuery(
        schemaQueries.getColumnNamesQuery("system", "tables"),
        "getColumnNamesQuery",
      );
    });
  });

  // ─── Discover Module ──────────────────────────────────────────────────────
  describe("Discover Queries", () => {
    test("getFieldValuesQuery", async () => {
      await checkQuery(
        discoverQueries.getFieldValuesQuery(
          "system.tables",
          "name",
          "",
          10,
        ),
        "getFieldValuesQuery",
      );
    });
  });
});
