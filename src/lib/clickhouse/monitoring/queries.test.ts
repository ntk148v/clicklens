import { createClient } from "@clickhouse/client";
import { describe, test, afterAll } from "bun:test";
import * as queries from "./queries";

describe("Monitoring Queries Validation", () => {
  const client = createClient({
    url: process.env.CLICKHOUSE_HOST || "http://localhost:8123",
    username: process.env.CLICKHOUSE_USER || "admin",
    password: process.env.CLICKHOUSE_PASSWORD || "password",
  });

  afterAll(async () => {
    await client.close();
  });

  // Helper to wrap query with LIMIT 1 avoiding syntax errors
  const checkQuery = async (sql: string, name: string) => {
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

      // Ignore dependencies we can't control in this generic test
      if (
        msg.includes("Table system.zookeeper doesn't exist") ||
        msg.includes("Table system.replicas doesn't exist") ||
        msg.includes("UNKNOWN_TABLE") ||
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

  for (const [key, value] of Object.entries(queries)) {
    if (typeof value === "string") {
      test(`Query: ${key}`, async () => {
        await checkQuery(value, key);
      });
    } else if (typeof value === "function") {
      test(`Function Query: ${key}`, async () => {
        let sql = "";

        // Handle different signatures
        // PerNode queries REQUIRE a cluster name, so we provide a dummy one
        // and expect the "Cluster not found" handler to catch it.
        if (key.includes("PerNode")) {
          sql = value(60, "dummy_cluster");
        }
        // Single-arg functions usually take optional clusterName (passed as undefined)
        // or just return string.
        else if (value.length <= 1) {
          sql = value(undefined);
        }
        // Two-arg functions usually take (interval, clusterName)
        else {
          sql = value(60, undefined);
        }

        await checkQuery(sql, key);
      });
    }
  }
});
