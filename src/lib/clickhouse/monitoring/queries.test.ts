import { createClient } from "@clickhouse/client";
import { describe, test, afterAll, beforeAll } from "bun:test";
import * as queries from "./queries";

// Build connection URL from environment variables (matching ClickLens config approach)
const getConnectionUrl = () => {
  const host = process.env.CLICKHOUSE_HOST || "localhost";
  const port = process.env.CLICKHOUSE_PORT || "8123";
  const secure = process.env.CLICKHOUSE_SECURE === "true";
  const protocol = secure ? "https" : "http";
  return `${protocol}://${host}:${port}`;
};

describe("Monitoring Queries Validation", () => {
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
    // Check if ClickHouse is available
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
        msg.includes("fetch failed")
      ) {
        console.warn(
          "⚠️  ClickHouse not available. Skipping monitoring queries validation tests.",
        );
        console.warn(
          "   To run these tests, start ClickHouse: docker run -d -p 8123:8123 clickhouse/clickhouse-server:latest",
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

  // Helper to wrap query with LIMIT 1 avoiding syntax errors
  const checkQuery = async (sql: string, name: string) => {
    // Skip if ClickHouse is not available
    if (!clickhouseAvailable) {
      console.warn(`Skipping ${name}: ClickHouse not available`);
      return;
    }

    try {
      let queryToCheck = sql;
      // Inject LIMIT 1 if missing
      if (!queryToCheck.toUpperCase().includes("LIMIT")) {
        // If SETTINGS clause exists, insert LIMIT before it
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

      // Ignore dependencies we can't control in this generic test
      if (
        msg.includes("Table system.zookeeper doesn't exist") ||
        msg.includes("Table system.replicas doesn't exist") ||
        msg.includes("UNKNOWN_TABLE") ||
        msg.includes("Unknown table expression identifier") ||
        // Handle clusterAllReplicas errors on single node
        (msg.includes("Cluster") && msg.includes("not found")) ||
        (msg.includes("Requested cluster") && msg.includes("not found"))
      ) {
        console.warn(
          `Skipping ${name}: Dependency missing or Cluster not found`,
        );
        return;
      }

      throw new Error(`Query "${name}" failed: ${msg}`);
    }
  };

  // Test time range params for dashboard queries (from/to/rounding pattern)
  const testFrom = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
  const testTo = new Date().toISOString();
  const testRounding = 60;

  // Skip non-query exports (utility functions that don't return SQL)
  const skipKeys = new Set(["computeRounding"]);

  for (const [key, value] of Object.entries(queries)) {
    if (skipKeys.has(key)) continue;

    if (typeof value === "string") {
      test(`Query: ${key}`, async () => {
        await checkQuery(value, key);
      });
    } else if (typeof value === "function") {
      test(`Function Query: ${key}`, async () => {
        let sql: string;

        // Handle different signatures
        // PerNode queries REQUIRE a cluster name, so we provide a dummy one
        // and expect the "Cluster not found" handler to catch it.
        if (key.includes("PerNode")) {
          sql = (value as (...args: unknown[]) => string)(60, "dummy_cluster");
        }
        // Dashboard queries take (from, to, rounding, clusterName?)
        else if (key.startsWith("getDashboard")) {
          sql = (value as (...args: unknown[]) => string)(
            testFrom,
            testTo,
            testRounding,
            undefined,
          );
        }
        // Single-arg functions usually take optional clusterName (passed as undefined)
        // or just return string.
        else if (value.length <= 1) {
          sql = (value as (...args: unknown[]) => string)(undefined);
        }
        // Two-arg functions usually take (interval, clusterName)
        else {
          sql = (value as (...args: unknown[]) => string)(60, undefined);
        }

        await checkQuery(sql, key);
      });
    }
  }
});
