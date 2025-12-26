/**
 * ClickHouse client configuration
 * Now uses session-based credentials instead of environment variables
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
 * Get default configuration (for fallback when env vars are set)
 * This is optional - mainly for development/testing
 */
export function getDefaultConfig(): ClickHouseConfig | null {
  const host = process.env.CLICKHOUSE_HOST;

  if (!host) {
    return null;
  }

  return {
    host,
    port: parseInt(process.env.CLICKHOUSE_PORT || "8123", 10),
    username: process.env.CLICKHOUSE_USER || "default",
    password: process.env.CLICKHOUSE_PASSWORD || "",
    database: process.env.CLICKHOUSE_DATABASE || "default",
    protocol: (process.env.CLICKHOUSE_PROTOCOL as "http" | "https") || "http",
  };
}

/**
 * Build ClickHouse URL from config
 */
export function buildClickHouseUrl(
  config: ClickHouseConfig,
  path: string = ""
): string {
  return `${config.protocol}://${config.host}:${config.port}${path}`;
}

/**
 * Build auth headers for ClickHouse
 */
export function buildAuthHeaders(
  config: ClickHouseConfig
): Record<string, string> {
  return {
    "X-ClickHouse-User": config.username,
    "X-ClickHouse-Key": config.password,
    "X-ClickHouse-Database": config.database,
  };
}
