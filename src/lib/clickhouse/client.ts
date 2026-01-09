/**
 * ClickHouse Client Factory
 * Creates a ClickHouse client using @clickhouse/client (HTTP interface)
 */

import { type ClickHouseConfig, getLensConfig } from "./config";
import { type ClickHouseClient } from "./clients/types";
import { ClickHouseClientImpl } from "./clients/client";

// Re-export types
export * from "./clients/types";
export { ClickHouseClientImpl } from "./clients/client";

/**
 * Create a ClickHouse client
 *
 * @param config - ClickHouse configuration. If not provided, uses environment variables via getLensConfig()
 * @returns ClickHouseClient instance using @clickhouse/client (HTTP interface)
 *
 * @example
 * // With explicit config
 * const client = createClient({
 *   host: "localhost",
 *   port: 8123,
 *   secure: false,
 *   verifySsl: true,
 *   username: "default",
 *   password: "",
 *   database: "default",
 * });
 *
 * @example
 * // Using environment variables
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

  return new ClickHouseClientImpl(resolvedConfig);
}
