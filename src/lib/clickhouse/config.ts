/**
 * ClickHouse client configuration
 *
 * Architecture:
 * - Server connection (host, port, protocol) from environment variables
 * - Lens user (for metadata queries) from environment variables
 * - End user credentials from session (for data queries)
 */

export interface ClickHouseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  protocol: "http" | "https";
  /** Client implementation: 'native' uses @clickhouse/client, 'http' uses fetch API */
  clientType?: "native" | "http";
}

/**
 * Get server connection config from environment
 * This is the base config without user credentials
 */
function getServerConnection(): {
  host: string;
  port: number;
  protocol: "http" | "https";
} | null {
  const host = process.env.CLICKHOUSE_HOST;

  if (!host) {
    return null;
  }

  return {
    host,
    port: parseInt(process.env.CLICKHOUSE_PORT || "8123", 10),
    protocol: (process.env.CLICKHOUSE_PROTOCOL as "http" | "https") || "http",
  };
}

/**
 * Get lens user config for metadata queries
 * Lens user has read access to system.* tables
 */
export function getLensConfig(): ClickHouseConfig | null {
  const server = getServerConnection();
  const lensUser = process.env.LENS_USER;

  if (!server || !lensUser) {
    return null;
  }

  return {
    ...server,
    username: lensUser,
    password: process.env.LENS_PASSWORD || "",
    database: "default",
  };
}

/**
 * Get user config by combining server connection with session credentials
 */
export function getUserConfig(credentials: {
  username: string;
  password: string;
  database?: string;
}): ClickHouseConfig | null {
  const server = getServerConnection();

  if (!server) {
    return null;
  }

  return {
    ...server,
    username: credentials.username,
    password: credentials.password,
    database: credentials.database || "default",
  };
}

/**
 * Get default configuration (legacy, for backward compatibility)
 */
export function getDefaultConfig(): ClickHouseConfig | null {
  return getLensConfig();
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

/**
 * Check if lens user is configured
 */
export function isLensUserConfigured(): boolean {
  return !!process.env.CLICKHOUSE_HOST && !!process.env.LENS_USER;
}
