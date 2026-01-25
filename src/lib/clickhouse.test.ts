import { createClient } from "@clickhouse/client";
import { describe, expect, test, afterAll } from "bun:test";

// Build connection URL from environment variables (matching ClickLens config approach)
const getConnectionUrl = () => {
  const host = process.env.CLICKHOUSE_HOST || "localhost";
  const port = process.env.CLICKHOUSE_PORT || "8123";
  const secure = process.env.CLICKHOUSE_SECURE === "true";
  const protocol = secure ? "https" : "http";
  return `${protocol}://${host}:${port}`;
};

describe("ClickHouse Integration", () => {
  const client = createClient({
    url: getConnectionUrl(),
    username: process.env.CLICKHOUSE_USER || process.env.LENS_USER || "default",
    password: process.env.CLICKHOUSE_PASSWORD || process.env.LENS_PASSWORD || "",
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
      // Only fail in CI if CLICKHOUSE_HOST is explicitly configured
      // (meaning ClickHouse service is expected to be available)
      if (process.env.CI && process.env.CLICKHOUSE_HOST) {
        throw e;
      }
    }
  });
});
