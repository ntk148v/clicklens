/**
 * ClickHouse configuration loaded from environment variables
 * Server-side only - never exposed to browser
 */

export interface ClickHouseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  protocol: "http" | "https";
}

/**
 * Get ClickHouse configuration from environment variables
 * This should only be called on the server side
 */
export function getClickHouseConfig(): ClickHouseConfig {
  if (typeof window !== "undefined") {
    throw new Error(
      "getClickHouseConfig should only be called on the server side"
    );
  }

  return {
    host: process.env.CLICKHOUSE_HOST || "localhost",
    port: parseInt(process.env.CLICKHOUSE_PORT || "8123", 10),
    username: process.env.CLICKHOUSE_USER || "default",
    password: process.env.CLICKHOUSE_PASSWORD || "",
    database: process.env.CLICKHOUSE_DATABASE || "default",
    protocol: (process.env.CLICKHOUSE_PROTOCOL as "http" | "https") || "http",
  };
}

/**
 * Build the ClickHouse base URL from config
 */
export function getClickHouseUrl(config: ClickHouseConfig): string {
  return `${config.protocol}://${config.host}:${config.port}`;
}
