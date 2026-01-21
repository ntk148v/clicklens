import { createClient } from "@clickhouse/client";
import { describe, expect, test, afterAll } from "bun:test";

describe("ClickHouse Integration", () => {
  const client = createClient({
    url: process.env.CLICKHOUSE_HOST || "http://localhost:8123",
    username: process.env.CLICKHOUSE_USER || "default",
    password: process.env.CLICKHOUSE_PASSWORD || "",
  });

  afterAll(async () => {
    await client.close();
  });

  test("should connect and return version", async () => {
    // Skip if no ClickHouse available (e.g. running unit tests in isolation w/o service)
    // But in CI this should run.
    try {
      const result = await client.query({
        query: "SELECT version()",
        format: "JSONEachRow",
      });
      const data = await result.json();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      console.log("ClickHouse Version:", data[0]);
    } catch (e) {
      console.warn(
        "ClickHouse connection failed. Ensure ClickHouse is running.",
      );
      // Fail the test if we expect it to run in CI
      if (process.env.CI) {
        throw e;
      }
    }
  });
});
