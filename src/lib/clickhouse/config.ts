/**
 * ClickHouse client configuration
 *
 * Environment Variables:
 * - CLICKHOUSE_HOST: ClickHouse server hostname
 * - CLICKHOUSE_PORT: ClickHouse HTTP port (default: 8123, or 8443 for HTTPS)
 * - CLICKHOUSE_SECURE: "true" or "false" (default: "false") - use HTTPS
 * - CLICKHOUSE_VERIFY: "true" or "false" (default: "true") - verify SSL certificate
 * - LENS_USER: Service user for metadata queries
 * - LENS_PASSWORD: Service user password
 *
 * Note: ClickLens uses ClickHouse HTTP interface (ports 8123/8443).
 * The native TCP protocol (ports 9000/9440) is NOT supported.
 */

export interface ClickHouseConfig {
  host: string;
  port: number;
  /** Use secure connection (HTTPS) */
  secure: boolean;
  /** Verify SSL certificate */
  verifySsl: boolean;
  username: string;
  password: string;
  database: string;
}

/**
 * Get server connection config from environment
 */
function getServerConnection(): Omit<
  ClickHouseConfig,
  "username" | "password" | "database"
> | null {
  const host = process.env.CLICKHOUSE_HOST;

  if (!host) {
    return null;
  }

  const secure = process.env.CLICKHOUSE_SECURE === "true";
  const verifySsl = process.env.CLICKHOUSE_VERIFY !== "false"; // Default to true

  // Default ports for HTTP interface
  const defaultPort = secure ? 8443 : 8123;

  return {
    host,
    port: parseInt(process.env.CLICKHOUSE_PORT || String(defaultPort), 10),
    secure,
    verifySsl,
  };
}

/**
 * Build connection URL from config
 */
export function buildConnectionUrl(
  config: Omit<ClickHouseConfig, "username" | "password" | "database">
): string {
  const scheme = config.secure ? "https" : "http";
  return `${scheme}://${config.host}:${config.port}`;
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
 * Build auth headers for ClickHouse HTTP interface
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
