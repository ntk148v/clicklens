/**
 * ClickHouse Client Factory
 * Creates either Native or HTTP client based on configuration
 */

import { type ClickHouseConfig, getLensConfig } from "./config";
import { type ClickHouseClient } from "./clients/types";
import { NativeClient } from "./clients/native";
import { HttpClient } from "./clients/http";

// Re-export types
export * from "./clients/types";
export { NativeClient } from "./clients/native";
export { HttpClient } from "./clients/http";

/**
 * Create a ClickHouse client
 *
 * @param config - ClickHouse configuration. If not provided, uses environment variables via getLensConfig()
 * @returns ClickHouseClient instance (either NativeClient or HttpClient based on config.clientType)
 *
 * @example
 * // With explicit config
 * const client = createClient({
 *   host: "localhost",
 *   port: 8123,
 *   protocol: "http",
 *   username: "default",
 *   password: "",
 *   database: "default",
 *   clientType: "native", // or "http"
 * });
 *
 * @example
 * // Using environment variables (CLICKHOUSE_HOST, LENS_USER, etc.)
 * const client = createClient();
 */
export function createClient(config?: ClickHouseConfig): ClickHouseClient {
  // If no config provided, use lens config from environment
  const resolvedConfig = config ?? getLensConfig();

  if (!resolvedConfig) {
    throw new Error(
      "ClickHouse configuration not provided and CLICKHOUSE_HOST/LENS_USER environment variables are not set"
    );
  }

  // Determine client type: explicit config > env var > default to "native"
  const clientType =
    resolvedConfig.clientType ||
    (process.env.CLICKHOUSE_CLIENT_TYPE as "native" | "http") ||
    "native";

  if (clientType === "http") {
    return new HttpClient(resolvedConfig);
  }

  return new NativeClient(resolvedConfig);
}

/**
 * @deprecated Use createClient() instead
 */
export const createClientWithConfig = createClient;
