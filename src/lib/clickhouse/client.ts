/**
 * ClickHouse Client Factory
 * Creates either Native or HTTP client based on configuration
 */

import { type ClickHouseConfig } from "./config";
import { type ClickHouseClient } from "./clients/types";
import { NativeClient } from "./clients/native";
import { HttpClient } from "./clients/http";

// Re-export types
export * from "./clients/types";
export { NativeClient } from "./clients/native";
export { HttpClient } from "./clients/http";

/**
 * Create a ClickHouse client with the given configuration
 */
export function createClientWithConfig(
  config: ClickHouseConfig
): ClickHouseClient {
  const clientType = process.env.CLICKHOUSE_CLIENT_TYPE || "native";

  if (clientType === "http") {
    return new HttpClient(config);
  }

  return new NativeClient(config);
}

/**
 * Legacy function for backwards compatibility
 * Creates a client using environment variables
 */
export function createClient(): ClickHouseClient {
  const host = process.env.CLICKHOUSE_HOST;

  if (!host) {
    throw new Error("CLICKHOUSE_HOST environment variable is not set");
  }

  return createClientWithConfig({
    host,
    port: parseInt(process.env.CLICKHOUSE_PORT || "8123", 10),
    username: process.env.CLICKHOUSE_USER || "default",
    password: process.env.CLICKHOUSE_PASSWORD || "",
    database: process.env.CLICKHOUSE_DATABASE || "default",
    protocol: (process.env.CLICKHOUSE_PROTOCOL as "http" | "https") || "http",
  });
}
